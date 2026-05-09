using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;
using NOC_Management_App.Models;
using Npgsql;
using Dapper;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace NOC_Management_App.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IConfiguration _config;
        private readonly string _connectionString;

        public AuthController(IConfiguration config)
        {
            _config = config;
            _connectionString = config.GetConnectionString("DefaultConnection")!;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            try
            {
                using var conn = new NpgsqlConnection(_connectionString);
                await conn.ExecuteAsync(@"
                    CREATE TABLE IF NOT EXISTS shift_overtime_flags (
                        shift_id UUID PRIMARY KEY REFERENCES shifts(id) ON DELETE CASCADE,
                        is_overtime BOOLEAN NOT NULL DEFAULT TRUE,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )");

                var sqlUser = @"
            SELECT id as Id, 
                   TRIM(CONCAT_WS(' ', last_name, first_name, patronymic)) as FullName, 
                   role as Role, 
                   email as Email, 
                   password_hash as PasswordHash, 
                   last_password_change as LastPasswordChange,
                   last_rest_hours as LastRestHours 
            FROM employees WHERE email = @Email";

                var user = await conn.QueryFirstOrDefaultAsync<UserLoginDto>(sqlUser, new { Email = request.GetLoginIdentifier() });

                // 1. Проверка существования пользователя
                if (user == null)
                    return Unauthorized(new { error = "Пользователь не найден" });

                // 2. Строгая проверка пароля через BCrypt
                if (string.IsNullOrEmpty(user.PasswordHash) || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
                    return Unauthorized(new { error = "Неверный пароль" });

                // 3. Проверка политики паролей (90 дней)
                DateTime lastChange = user.LastPasswordChange ?? DateTime.UtcNow;
                bool requirePasswordChange = (DateTime.UtcNow - lastChange).TotalDays >= 90;
                var passwordChangeDueAt = lastChange.AddDays(90);

                // 4. Подгрузка допусков
                var sqlClearances = @"
            SELECT ct.name 
            FROM employee_clearances ec 
            JOIN clearance_types ct ON ec.clearance_id = ct.id 
            WHERE ec.employee_id = @Id";

                var clearances = await conn.QueryAsync<string>(sqlClearances, new { Id = user.Id });
                var clearancesArray = clearances.ToArray();

                // 🔴 ДОБАВИТЬ: Загрузка смен при входе
                var sqlShifts = @"
    SELECT id, employee_id as EmployeeId, work_area_id as WorkAreaId, 
           TO_CHAR(shift_date::date, 'YYYY-MM-DD') as ShiftDate, shift_type as ShiftType, 
           TO_CHAR(start_time, 'HH24:MI:SS') as StartTime,
           TO_CHAR(end_time, 'HH24:MI:SS') as EndTime,
           COALESCE(status, 'Confirmed') as Status,
           EXISTS (SELECT 1 FROM shift_overtime_flags sof WHERE sof.shift_id = shifts.id) as IsOvertime
    FROM shifts 
    WHERE employee_id = @Id 
    ORDER BY shift_date DESC";

                var shifts = await conn.QueryAsync<ShiftListItemDto>(sqlShifts, new { Id = user.Id });
                var shiftsArray = shifts.ToList();

                // 5. Генерация JWT токена
                var tokenHandler = new JwtSecurityTokenHandler();
                var key = Encoding.ASCII.GetBytes(_config["Jwt:Key"]!);
                var tokenDescriptor = new SecurityTokenDescriptor
                {
                    Subject = new ClaimsIdentity(new[] {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, user.Role)
            }),
                    Expires = DateTime.UtcNow.AddDays(1),
                    SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature),
                    Issuer = _config["Jwt:Issuer"],
                    Audience = _config["Jwt:Audience"]
                };
                var token = tokenHandler.CreateToken(tokenDescriptor);

                return Ok(new
                {
                    id = user.Id,
                    name = user.FullName,
                    role = user.Role,
                    email = user.Email,
                    clearances = clearancesArray,
                    shifts = shiftsArray,
                    lastRestHours = user.LastRestHours,
                    token = tokenHandler.WriteToken(token),
                    requirePasswordChange = requirePasswordChange,
                    lastPasswordChange = lastChange,
                    passwordChangeDueAt = passwordChangeDueAt
                });
            }
            catch (PostgresException ex)
            {
                return StatusCode(500, new { error = $"Ошибка БД: {ex.MessageText}" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = $"Сбой: {ex.Message}" });
            }
        }

        [HttpGet("me")]
        [Authorize]
        public async Task<IActionResult> GetMe()
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
                return Unauthorized();

            using var conn = new NpgsqlConnection(_connectionString);
            await conn.ExecuteAsync(@"
                CREATE TABLE IF NOT EXISTS shift_overtime_flags (
                    shift_id UUID PRIMARY KEY REFERENCES shifts(id) ON DELETE CASCADE,
                    is_overtime BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                )");

            var sqlUser = @"
                SELECT id as Id, 
                       TRIM(CONCAT_WS(' ', last_name, first_name, patronymic)) as FullName, 
                       role as Role, 
                       email as Email,
                       last_password_change as LastPasswordChange
                FROM employees WHERE id = @Id";

            var user = await conn.QueryFirstOrDefaultAsync<UserLoginDto>(sqlUser, new { Id = userId });

            if (user == null)
                return Unauthorized();

            DateTime lastChange = user.LastPasswordChange ?? DateTime.UtcNow;
            bool requirePasswordChange = (DateTime.UtcNow - lastChange).TotalDays >= 90;
            var passwordChangeDueAt = lastChange.AddDays(90);

            var sqlShifts = @"
                SELECT 
                    id,
                    employee_id as EmployeeId,
                    work_area_id as WorkAreaId,
                    TO_CHAR(shift_date::date, 'YYYY-MM-DD') as ShiftDate,
                    shift_type as ShiftType,
                    TO_CHAR(start_time, 'HH24:MI:SS') as StartTime,
                    TO_CHAR(end_time, 'HH24:MI:SS') as EndTime,
                    COALESCE(status, 'Confirmed') as Status,
                    EXISTS (SELECT 1 FROM shift_overtime_flags sof WHERE sof.shift_id = shifts.id) as IsOvertime
                FROM shifts
                WHERE employee_id = @Id
                ORDER BY shift_date DESC";
            var shifts = await conn.QueryAsync<ShiftListItemDto>(sqlShifts, new { Id = userId });

            return Ok(new
            {
                id = user.Id,
                name = user.FullName,
                role = user.Role,
                email = user.Email,
                requirePasswordChange = requirePasswordChange,
                lastPasswordChange = lastChange,
                passwordChangeDueAt = passwordChangeDueAt,
                shifts = shifts
            });
        }
    


    [HttpPost("change-password")]
        [Authorize]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
        {
            try
            {
                var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
                    return Unauthorized();

                if (string.IsNullOrEmpty(request.OldPassword) || string.IsNullOrEmpty(request.NewPassword))
                    return BadRequest(new { error = "Старый и новый пароли обязательны" });

                if (!PasswordPolicy.TryValidate(request.NewPassword, out var passwordPolicyError))
                    return BadRequest(new { error = passwordPolicyError });

                using var conn = new NpgsqlConnection(_connectionString);

                // 1. Получить текущий хэш пароля
                var userSql = "SELECT password_hash FROM employees WHERE id = @Id";
                var currentPasswordHash = await conn.ExecuteScalarAsync<string>(userSql, new { Id = userId });

                if (string.IsNullOrEmpty(currentPasswordHash))
                    return Unauthorized(new { error = "Пользователь не найден" });

                // 2. Проверить старый пароль
                if (!BCrypt.Net.BCrypt.Verify(request.OldPassword, currentPasswordHash))
                    return BadRequest(new { error = "Старый пароль неверный" });

                if (request.OldPassword == request.NewPassword)
                    return BadRequest(new { error = "Новый пароль должен отличаться от текущего" });

                // 3. Хэшировать новый пароль
                string newPasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);

                // 4. Обновить пароль и дату последнего изменения
                var updateSql = @"
            UPDATE employees 
            SET password_hash = @NewPasswordHash, 
                last_password_change = CURRENT_TIMESTAMP 
            WHERE id = @Id";

                await conn.ExecuteAsync(updateSql, new { NewPasswordHash = newPasswordHash, Id = userId });

                // 5. Логировать в аудит
                try
                {
                    var userEmail = User.FindFirst(ClaimTypes.Email)?.Value ?? "Unknown";
                    var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

                    await conn.ExecuteAsync(
                        "INSERT INTO audit_logs (user_name, action, ip_address) VALUES (@UserName, @Action, @Ip)",
                        new { UserName = userEmail, Action = "Пароль изменен", Ip = ipAddress }
                    );
                }
                catch (Exception logEx)
                {
                    Console.WriteLine($"Ошибка аудита: {logEx.Message}");
                }

                return Ok(new
                {
                    message = "Пароль успешно изменен",
                    lastPasswordChange = DateTime.UtcNow,
                    passwordChangeDueAt = DateTime.UtcNow.AddDays(90),
                    requirePasswordChange = false
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Ошибка при изменении пароля", details = ex.Message });
            }
        }
    }
}

public class ChangePasswordRequest
    {
        public string OldPassword { get; set; } = "";
        public string NewPassword { get; set; } = "";
    }

    public class LoginRequest
    {
        public string? Email { get; set; }
        public string? Username { get; set; }
        public string? Password { get; set; }

        public string GetLoginIdentifier()
        {
            return !string.IsNullOrEmpty(Email) ? Email : (Username ?? string.Empty);
        }
    }

    public class UserLoginDto
    {
        public Guid Id { get; set; }
        public string FullName { get; set; } = "";
        public string Role { get; set; } = "";
        public string Email { get; set; } = "";
        public string PasswordHash { get; set; } = "";
        public DateTime? LastPasswordChange { get; set; }
        public int LastRestHours { get; set; }
    }
