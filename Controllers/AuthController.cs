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

                // 4. Подгрузка допусков
                var sqlClearances = @"
            SELECT ct.name 
            FROM employee_clearances ec 
            JOIN clearance_types ct ON ec.clearance_id = ct.id 
            WHERE ec.employee_id = @Id";

                var clearances = await conn.QueryAsync<string>(sqlClearances, new { Id = user.Id });
                var clearancesArray = clearances.ToArray();

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
                    lastRestHours = user.LastRestHours,
                    token = tokenHandler.WriteToken(token),
                    requirePasswordChange = requirePasswordChange
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

            var sqlUser = @"
                SELECT id as Id, 
                       TRIM(CONCAT_WS(' ', last_name, first_name, patronymic)) as FullName, 
                       role as Role, 
                       email as Email 
                FROM employees WHERE id = @Id";

            var user = await conn.QueryFirstOrDefaultAsync<Employee>(sqlUser, new { Id = userId });

            if (user == null)
                return Unauthorized();

            return Ok(new
            {
                id = user.Id,
                name = user.FullName,
                role = user.Role,
                email = user.Email
            });
        }
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
}