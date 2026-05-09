using Microsoft.AspNetCore.Mvc;
using Npgsql;
using Dapper;
using NOC_Management_App.Models;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace NOC_Management_App.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class EmployeesController : ControllerBase
    {
        private readonly string _connectionString;

        public EmployeesController(IConfiguration config)
        {
            _connectionString = config.GetConnectionString("DefaultConnection")!;
        }

        // НОВЫЙ ЭНДПОИНТ ДЛЯ ПОЛУЧЕНИЯ ГРЕЙДОВ
        [HttpGet("grades")]
        public async Task<IActionResult> GetGrades()
        {
            using var conn = new NpgsqlConnection(_connectionString);
            var grades = await conn.QueryAsync("SELECT id as Id, name as Name, level as Level FROM grades ORDER BY level");
            return Ok(grades);
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            try
            {
                using var conn = new NpgsqlConnection(_connectionString);

                // Добавлено получение grade_id
                var sqlEmp = @"
                    SELECT id as Id, 
                           TRIM(CONCAT_WS(' ', last_name, first_name, patronymic)) as FullName, 
                           role as Role, 
                           email as Email, 
                           last_rest_hours as LastRestHours,
                           grade_id as GradeId
                    FROM employees 
                    ORDER BY last_name, first_name";

                var employees = (await conn.QueryAsync<Employee>(sqlEmp)).ToList();

                foreach (var emp in employees)
                {
                    var sqlClearances = @"
                        SELECT ct.name 
                        FROM employee_clearances ec 
                        JOIN clearance_types ct ON ec.clearance_id = ct.id 
                        WHERE ec.employee_id = @Id";
                    var clearances = await conn.QueryAsync<string>(sqlClearances, new { Id = emp.Id });
                    emp.Clearances = clearances.ToArray() ?? Array.Empty<string>();
                }

                return Ok(employees);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Ошибка БД при получении сотрудников", details = ex.Message });
            }
        }

        [HttpGet("clearances")]
        public async Task<IActionResult> GetClearanceTypes()
        {
            using var conn = new NpgsqlConnection(_connectionString);
            var types = await conn.QueryAsync<string>("SELECT name FROM clearance_types ORDER BY name");
            return Ok(types);
        }

        [HttpGet("clearances/full")]
        public async Task<IActionResult> GetClearanceTypesFull()
        {
            using var conn = new NpgsqlConnection(_connectionString);
            var sql = "SELECT id as Id, name as Name FROM clearance_types ORDER BY name";
            var types = await conn.QueryAsync<ClearanceTypeDto>(sql);
            return Ok(types);
        }

        [HttpPost]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> Create([FromBody] CreateEmployeeDto request)
        {
            using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            if (request.Role == "Manager" || request.Role == "Admin")
                request.Clearances = Array.Empty<string>();

            var emailExists = await conn.ExecuteScalarAsync<bool>("SELECT EXISTS(SELECT 1 FROM employees WHERE email = @Email)", new { request.Email });
            if (emailExists)
                return BadRequest(new { error = "Сотрудник с такой корпоративной почтой уже существует." });

            if (!PasswordPolicy.TryValidate(request.TempPassword, out var passwordPolicyError))
                return BadRequest(new { error = passwordPolicyError });

            using var trans = await conn.BeginTransactionAsync();
            try
            {
                string hashedPassword = BCrypt.Net.BCrypt.HashPassword(request.TempPassword);

                // Добавлен grade_id в INSERT
                var sql = @"
                    INSERT INTO employees (last_name, first_name, patronymic, role, email, password_hash, last_rest_hours, grade_id) 
                    VALUES (@LastName, @FirstName, @Patronymic, @Role, @Email, @PasswordHash, 48, @GradeId) 
                    RETURNING id";

                var newId = await conn.ExecuteScalarAsync<Guid>(sql, new
                {
                    request.LastName,
                    request.FirstName,
                    request.Patronymic,
                    request.Role,
                    request.Email,
                    PasswordHash = hashedPassword,
                    request.GradeId
                });

                if (request.Clearances != null && request.Clearances.Any())
                {
                    foreach (var cls in request.Clearances)
                    {
                        var clsId = await conn.ExecuteScalarAsync<int>("INSERT INTO clearance_types (name) VALUES (@cls) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id", new { cls });
                        await conn.ExecuteAsync("INSERT INTO employee_clearances (employee_id, clearance_id) VALUES (@EmpId, @ClsId) ON CONFLICT DO NOTHING", new { EmpId = newId, ClsId = clsId });
                    }
                }

                try
                {
                    var adminEmail = User.FindFirst(ClaimTypes.Email)?.Value ?? "Admin";
                    var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

                    await conn.ExecuteAsync(
                        "INSERT INTO audit_logs (user_name, action, ip_address) VALUES (@AdminName, @Action, @Ip)",
                        new { AdminName = adminEmail, Action = $"Создан сотрудник: {request.Email} ({request.Role})", Ip = ipAddress }
                    );
                }
                catch (Exception logEx)
                {
                    Console.WriteLine($"Ошибка записи в аудит: {logEx.Message}");
                }

                await trans.CommitAsync();
                return Ok(new { message = "Сотрудник успешно создан", id = newId });
            }
            catch (Exception ex)
            {
                await trans.RollbackAsync();
                return StatusCode(500, new { error = "Ошибка при создании сотрудника", details = ex.Message });
            }
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> Update(Guid id, [FromBody] Employee emp)
        {
            var actorRole = User.FindFirst(ClaimTypes.Role)?.Value ?? string.Empty;
            var actorIdRaw = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            Guid.TryParse(actorIdRaw, out var actorId);
            if (actorRole == "Manager" && actorId == id)
                return Forbid();

            if (emp.Role == "Manager" || emp.Role == "Admin")
                emp.Clearances = Array.Empty<string>();

            using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();
            using var trans = await conn.BeginTransactionAsync();
            try
            {
                var parts = emp.FullName?.Split(' ', StringSplitOptions.RemoveEmptyEntries) ?? new string[0];
                string lastName = parts.Length > 0 ? parts[0] : "Неизвестно";
                string firstName = parts.Length > 1 ? parts[1] : "";
                string patronymic = parts.Length > 2 ? string.Join(" ", parts.Skip(2)) : "";

                // Добавлен grade_id в UPDATE
                var sql = "UPDATE employees SET last_name = @LastName, first_name = @FirstName, patronymic = @Patronymic, role = @Role, email = @Email, grade_id = @GradeId WHERE id = @id";
                await conn.ExecuteAsync(sql, new { LastName = lastName, FirstName = firstName, Patronymic = patronymic, emp.Role, emp.Email, emp.GradeId, id });

                await conn.ExecuteAsync("DELETE FROM employee_clearances WHERE employee_id = @id", new { id });
                if (emp.Clearances != null)
                {
                    foreach (var cls in emp.Clearances)
                    {
                        var clsId = await conn.ExecuteScalarAsync<int>("INSERT INTO clearance_types (name) VALUES (@cls) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id", new { cls });
                        await conn.ExecuteAsync("INSERT INTO employee_clearances (employee_id, clearance_id) VALUES (@EmpId, @ClsId)", new { EmpId = id, ClsId = clsId });
                    }
                }

                await trans.CommitAsync();
                return Ok(emp);
            }
            catch (Exception ex)
            {
                await trans.RollbackAsync();
                return StatusCode(500, ex.Message);
            }
        }
    }

    public class CreateEmployeeDto
    {
        public string LastName { get; set; } = null!;
        public string FirstName { get; set; } = null!;
        public string Patronymic { get; set; } = "";
        public string Email { get; set; } = null!;
        public string Role { get; set; } = null!;
        public string TempPassword { get; set; } = null!;
        public int? GradeId { get; set; } // Добавлено
        public string[]? Clearances { get; set; }
    }

    public class ClearanceTypeDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
    }
}