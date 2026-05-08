using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using System.Security.Claims;
using System.Text.Json.Serialization;

namespace NOC_Management_App.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class VacationsController : ControllerBase
    {
        private readonly string _connectionString;

        public VacationsController(IConfiguration config)
        {
            _connectionString = config.GetConnectionString("DefaultConnection")!;
        }

        [HttpGet]
        public async Task<IActionResult> Get([FromQuery] Guid? employeeId = null)
        {
            using var conn = new NpgsqlConnection(_connectionString);

            var role = User.FindFirst(ClaimTypes.Role)?.Value ?? "Engineer";
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            Guid.TryParse(userIdStr, out var currentUserId);

            Guid? targetEmployeeId = employeeId;
            if (role == "Engineer")
            {
                targetEmployeeId = currentUserId;
            }

            var sql = @"
                SELECT
                    v.id as Id,
                    v.employee_id as EmployeeId,
                    COALESCE(v.leave_type, 'Annual') as LeaveType,
                    TO_CHAR(v.start_date::date, 'YYYY-MM-DD') as StartDate,
                    TO_CHAR(v.end_date::date, 'YYYY-MM-DD') as EndDate,
                    v.status as Status,
                    v.created_at as CreatedAt
                FROM vacations v
                WHERE (@EmployeeId IS NULL OR v.employee_id = @EmployeeId)
                ORDER BY v.start_date DESC
                LIMIT 500";

            var rows = await conn.QueryAsync<VacationDto>(sql, new { EmployeeId = targetEmployeeId });
            return Ok(rows);
        }

        [HttpPost]
        public async Task<IActionResult> RequestVacation([FromBody] VacationRequestDto request)
        {
            if (request.EmployeeId == Guid.Empty)
                return BadRequest(new { error = "Не указан сотрудник" });
            if (request.StartDate == default || request.EndDate == default || request.EndDate < request.StartDate)
                return BadRequest(new { error = "Некорректный период отпуска" });
            var maxAllowedDate = new DateTime(DateTime.UtcNow.Year + 1, 12, 31);
            if (request.StartDate.Year < 1999 || request.EndDate.Year < 1999)
                return BadRequest(new { error = "Год отпуска не может быть меньше 1999" });
            if (request.EndDate.Date > maxAllowedDate.Date)
                return BadRequest(new { error = $"Дата окончания отпуска не может быть позже {maxAllowedDate:yyyy-MM-dd}" });

            var role = User.FindFirst(ClaimTypes.Role)?.Value ?? "Engineer";
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            Guid.TryParse(userIdStr, out var currentUserId);
            if (role == "Engineer" && request.EmployeeId != currentUserId)
                return Forbid();

            using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();
            using var tx = await conn.BeginTransactionAsync();

            // Запрет пересекающихся Approved отпусков.
            // Исключение: больничный можно подать даже на даты ежегодного отпуска.
            var overlap = await conn.ExecuteScalarAsync<bool>(@"
                SELECT EXISTS(
                    SELECT 1
                    FROM vacations
                    WHERE employee_id = @EmployeeId
                      AND status = 'Approved'
                      AND NOT (@LeaveType = 'Sick' AND COALESCE(leave_type, 'Annual') = 'Annual')
                      AND start_date <= @EndDate::date
                      AND end_date >= @StartDate::date
                )", new
            {
                request.EmployeeId,
                LeaveType = string.IsNullOrWhiteSpace(request.LeaveType) ? "Annual" : request.LeaveType,
                request.StartDate,
                request.EndDate
            }, tx);

            if (overlap)
                return BadRequest(new { error = "У сотрудника уже есть утвержденный отпуск в этом периоде" });

            var id = await conn.ExecuteScalarAsync<long>(@"
                INSERT INTO vacations (employee_id, leave_type, start_date, end_date, status)
                VALUES (@EmployeeId, @LeaveType, @StartDate::date, @EndDate::date, 'Pending')
                RETURNING id", new
                {
                    request.EmployeeId,
                    LeaveType = string.IsNullOrWhiteSpace(request.LeaveType) ? "Annual" : request.LeaveType,
                    request.StartDate,
                    request.EndDate
                }, tx);

            // аудит
            var actor = User.FindFirst(ClaimTypes.Email)?.Value
                        ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                        ?? "Unknown";
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
            await conn.ExecuteAsync(
                "INSERT INTO audit_logs (user_name, action, ip_address) VALUES (@UserName, @Action, @Ip)",
                new { UserName = actor, Action = $"VACATION_REQUEST: employeeId={request.EmployeeId}, leaveType={request.LeaveType}, {request.StartDate:yyyy-MM-dd}..{request.EndDate:yyyy-MM-dd}", Ip = ip },
                tx
            );

            await tx.CommitAsync();
            return Ok(new { id, message = "Заявка на отпуск создана" });
        }

        [HttpPatch("{id:long}/status")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> SetStatus(long id, [FromBody] VacationStatusDto request)
        {
            if (id <= 0) return BadRequest(new { error = "Некорректный id" });
            if (request.Status != "Approved" && request.Status != "Rejected")
                return BadRequest(new { error = "Некорректный статус" });

            using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();
            using var tx = await conn.BeginTransactionAsync();

            var updated = await conn.ExecuteAsync(@"
                UPDATE vacations
                SET status = @Status,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = @Id", new { Id = id, request.Status }, tx);

            if (updated == 0) return NotFound(new { error = "Заявка не найдена" });

            var actor = User.FindFirst(ClaimTypes.Email)?.Value
                        ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                        ?? "Unknown";
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
            await conn.ExecuteAsync(
                "INSERT INTO audit_logs (user_name, action, ip_address) VALUES (@UserName, @Action, @Ip)",
                new { UserName = actor, Action = $"VACATION_STATUS_SET: id={id}, status={request.Status}", Ip = ip },
                tx
            );

            await tx.CommitAsync();
            return Ok(new { message = "Статус отпуска обновлен" });
        }

        [HttpPut("{id:long}")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> UpdateVacation(long id, [FromBody] UpdateVacationDto request)
        {
            if (id <= 0) return BadRequest(new { error = "Некорректный id" });
            if (request.StartDate == default || request.EndDate == default || request.EndDate < request.StartDate)
                return BadRequest(new { error = "Некорректный период отпуска" });
            var maxAllowedDate = new DateTime(DateTime.UtcNow.Year + 1, 12, 31);
            if (request.StartDate.Year < 1999 || request.EndDate.Year < 1999)
                return BadRequest(new { error = "Год отпуска не может быть меньше 1999" });
            if (request.EndDate.Date > maxAllowedDate.Date)
                return BadRequest(new { error = $"Дата окончания отпуска не может быть позже {maxAllowedDate:yyyy-MM-dd}" });
            if (request.Status != "Pending" && request.Status != "Approved" && request.Status != "Rejected")
                return BadRequest(new { error = "Некорректный статус" });

            using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();
            using var tx = await conn.BeginTransactionAsync();

            var updated = await conn.ExecuteAsync(@"
                UPDATE vacations
                SET leave_type = @LeaveType,
                    start_date = @StartDate::date,
                    end_date = @EndDate::date,
                    status = @Status,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = @Id", new
            {
                Id = id,
                LeaveType = string.IsNullOrWhiteSpace(request.LeaveType) ? "Annual" : request.LeaveType,
                request.StartDate,
                request.EndDate,
                request.Status
            }, tx);
            if (updated == 0) return NotFound(new { error = "Отпуск не найден" });

            var actor = User.FindFirst(ClaimTypes.Email)?.Value
                        ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                        ?? "Unknown";
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
            await conn.ExecuteAsync(
                "INSERT INTO audit_logs (user_name, action, ip_address) VALUES (@UserName, @Action, @Ip)",
                new
                {
                    UserName = actor,
                    Action = $"VACATION_UPDATE: id={id}, leaveType={request.LeaveType}, status={request.Status}, {request.StartDate:yyyy-MM-dd}..{request.EndDate:yyyy-MM-dd}",
                    Ip = ip
                },
                tx
            );

            await tx.CommitAsync();
            return Ok(new { message = "Отпуск обновлен" });
        }

        [HttpDelete("{id:long}")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> DeleteVacation(long id)
        {
            if (id <= 0) return BadRequest(new { error = "Некорректный id" });

            using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();
            using var tx = await conn.BeginTransactionAsync();

            var deleted = await conn.ExecuteAsync("DELETE FROM vacations WHERE id = @Id", new { Id = id }, tx);
            if (deleted == 0) return NotFound(new { error = "Отпуск не найден" });

            var actor = User.FindFirst(ClaimTypes.Email)?.Value
                        ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                        ?? "Unknown";
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
            await conn.ExecuteAsync(
                "INSERT INTO audit_logs (user_name, action, ip_address) VALUES (@UserName, @Action, @Ip)",
                new { UserName = actor, Action = $"VACATION_DELETE: id={id}", Ip = ip },
                tx
            );

            await tx.CommitAsync();
            return Ok(new { message = "Отпуск удален" });
        }

        [HttpPost("plan")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> PlanVacation([FromBody] PlanVacationDto request)
        {
            if (request.EmployeeId == Guid.Empty)
                return BadRequest(new { error = "Не указан сотрудник" });
            if (request.StartDate == default || request.EndDate == default || request.EndDate < request.StartDate)
                return BadRequest(new { error = "Некорректный период отпуска" });
            var maxAllowedDate = new DateTime(DateTime.UtcNow.Year + 1, 12, 31);
            if (request.StartDate.Year < 1999 || request.EndDate.Year < 1999)
                return BadRequest(new { error = "Год отпуска не может быть меньше 1999" });
            if (request.EndDate.Date > maxAllowedDate.Date)
                return BadRequest(new { error = $"Дата окончания отпуска не может быть позже {maxAllowedDate:yyyy-MM-dd}" });
            using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();
            using var tx = await conn.BeginTransactionAsync();

            var id = await conn.ExecuteScalarAsync<long>(@"
                INSERT INTO vacations (employee_id, leave_type, start_date, end_date, status)
                VALUES (@EmployeeId, @LeaveType, @StartDate::date, @EndDate::date, @Status)
                RETURNING id",
                new
                {
                    request.EmployeeId,
                    LeaveType = string.IsNullOrWhiteSpace(request.LeaveType) ? "Annual" : request.LeaveType,
                    request.StartDate,
                    request.EndDate,
                    Status = "Approved"
                }, tx);

            var actor = User.FindFirst(ClaimTypes.Email)?.Value
                        ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                        ?? "Unknown";
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
            await conn.ExecuteAsync(
                "INSERT INTO audit_logs (user_name, action, ip_address) VALUES (@UserName, @Action, @Ip)",
                new
                {
                    UserName = actor,
                    Action = $"VACATION_PLAN_CREATE: id={id}, employeeId={request.EmployeeId}, leaveType={request.LeaveType}, status=Approved, {request.StartDate:yyyy-MM-dd}..{request.EndDate:yyyy-MM-dd}",
                    Ip = ip
                },
                tx
            );

            await tx.CommitAsync();
            return Ok(new { id, message = "Отпуск добавлен в график" });
        }
    }

    public class VacationDto
    {
        [JsonPropertyName("id")]
        public long Id { get; set; }

        [JsonPropertyName("employeeId")]
        public Guid EmployeeId { get; set; }

        [JsonPropertyName("startDate")]
        public string StartDate { get; set; } = string.Empty;

        [JsonPropertyName("leaveType")]
        public string LeaveType { get; set; } = "Annual";

        [JsonPropertyName("endDate")]
        public string EndDate { get; set; } = string.Empty;

        [JsonPropertyName("status")]
        public string Status { get; set; } = "Pending";

        [JsonPropertyName("createdAt")]
        public DateTime CreatedAt { get; set; }
    }

    public class VacationRequestDto
    {
        public Guid EmployeeId { get; set; }
        public string LeaveType { get; set; } = "Annual";
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
    }

    public class VacationStatusDto
    {
        public string Status { get; set; } = "";
    }

    public class PlanVacationDto
    {
        public Guid EmployeeId { get; set; }
        public string LeaveType { get; set; } = "Annual";
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public string Status { get; set; } = "Approved";
    }

    public class UpdateVacationDto
    {
        public string LeaveType { get; set; } = "Annual";
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public string Status { get; set; } = "Approved";
    }
}

