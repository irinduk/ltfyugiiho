using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Npgsql;
using Dapper;
using System.Security.Claims;

namespace NOC_Management_App.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ReportsController : ControllerBase
    {
        private readonly string _connectionString;

        public ReportsController(IConfiguration config)
        {
            _connectionString = config.GetConnectionString("DefaultConnection")!;
        }

        [HttpGet("shifts-summary")]
        public async Task<IActionResult> GetShiftsSummary([FromQuery] DateTime startDate, [FromQuery] DateTime endDate)
        {
            if (startDate == default || endDate == default || endDate < startDate)
                return BadRequest(new { error = "Некорректный период отчета" });

            using var conn = new NpgsqlConnection(_connectionString);
            await conn.ExecuteAsync(@"
                CREATE TABLE IF NOT EXISTS shift_overtime_flags (
                    shift_id UUID PRIMARY KEY REFERENCES shifts(id) ON DELETE CASCADE,
                    is_overtime BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                )");

            var sql = @"
                SELECT 
                    e.id as EmployeeId,
                    TRIM(CONCAT_WS(' ', e.last_name, e.first_name, e.patronymic)) as EmployeeName,
                    COUNT(*) as TotalShifts,
                    COUNT(CASE WHEN s.status = 'Confirmed' THEN 1 END) as ConfirmedShifts,
                    COUNT(CASE WHEN sof.is_overtime = TRUE THEN 1 END) as OvertimeShifts,
                    COUNT(CASE WHEN s.status = 'PendingSwap' THEN 1 END) as PendingSwaps,
                    SUM(
                        CASE
                            WHEN s.end_time >= s.start_time THEN EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600
                            ELSE EXTRACT(EPOCH FROM ((s.end_time + INTERVAL '24 hours') - s.start_time)) / 3600
                        END
                    )::int as TotalHours,
                    SUM(
                        CASE
                            WHEN sof.is_overtime = TRUE THEN
                                CASE
                                    WHEN s.end_time >= s.start_time THEN EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600
                                    ELSE EXTRACT(EPOCH FROM ((s.end_time + INTERVAL '24 hours') - s.start_time)) / 3600
                                END
                            ELSE 0
                        END
                    )::numeric(10,2) as OvertimeHours
                FROM employees e
                LEFT JOIN shifts s ON e.id = s.employee_id 
                    AND s.shift_date >= @StartDate 
                    AND s.shift_date <= @EndDate
                LEFT JOIN shift_overtime_flags sof ON sof.shift_id = s.id
                GROUP BY e.id, e.last_name, e.first_name, e.patronymic
                ORDER BY e.last_name, e.first_name";

            var report = await conn.QueryAsync<dynamic>(sql, new { StartDate = startDate, EndDate = endDate });
            return Ok(report);
        }

        [HttpGet("employee-shifts/{employeeId}")]
        public async Task<IActionResult> GetEmployeeShifts(Guid employeeId, [FromQuery] DateTime startDate, [FromQuery] DateTime endDate)
        {
            if (startDate == default || endDate == default || endDate < startDate)
                return BadRequest(new { error = "Некорректный период отчета" });

            using var conn = new NpgsqlConnection(_connectionString);
            await conn.ExecuteAsync(@"
                CREATE TABLE IF NOT EXISTS shift_overtime_flags (
                    shift_id UUID PRIMARY KEY REFERENCES shifts(id) ON DELETE CASCADE,
                    is_overtime BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                )");

            var sql = @"
                SELECT 
                    s.id, s.employee_id as EmployeeId, s.work_area_id as WorkAreaId,
                    TO_CHAR(s.shift_date::date, 'YYYY-MM-DD') as ShiftDate, s.shift_type as ShiftType,
                    TO_CHAR(s.start_time, 'HH24:MI:SS') as StartTime, TO_CHAR(s.end_time, 'HH24:MI:SS') as EndTime,
                    s.status,
                    CASE
                        WHEN s.end_time >= s.start_time THEN EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600
                        ELSE EXTRACT(EPOCH FROM ((s.end_time + INTERVAL '24 hours') - s.start_time)) / 3600
                    END::numeric(10,2) as ShiftHours,
                    COALESCE(sof.is_overtime, FALSE) as IsOvertime,
                    s.updated_at as UpdatedAt
                FROM shifts s
                LEFT JOIN shift_overtime_flags sof ON sof.shift_id = s.id
                WHERE s.employee_id = @EmployeeId
                    AND s.shift_date >= @StartDate
                    AND s.shift_date <= @EndDate
                ORDER BY s.shift_date DESC";

            var shifts = await conn.QueryAsync<dynamic>(sql, new { EmployeeId = employeeId, StartDate = startDate, EndDate = endDate });
            return Ok(shifts);
        }

        [HttpGet("violations")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> GetScheduleViolations([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            using var conn = new NpgsqlConnection(_connectionString);
            var actualEnd = endDate?.Date ?? DateTime.UtcNow.Date;
            var actualStart = startDate?.Date ?? actualEnd.AddDays(-30);

            if (actualEnd < actualStart)
                return BadRequest(new { error = "Некорректный период отчета" });

            // Пример: сотрудники с нарушениями графика (смены со статусом PendingSwap)
            var sql = @"
                SELECT 
                    e.id as EmployeeId,
                    TRIM(CONCAT_WS(' ', e.last_name, e.first_name, e.patronymic)) as EmployeeName,
                    COUNT(*) as ViolationCount,
                    STRING_AGG(DISTINCT s.shift_type, ', ') as ViolationTypes
                FROM employees e
                JOIN shifts s ON e.id = s.employee_id
                WHERE s.status = 'PendingSwap' 
                    AND s.shift_date >= @StartDate
                    AND s.shift_date <= @EndDate
                GROUP BY e.id, e.last_name, e.first_name, e.patronymic
                ORDER BY ViolationCount DESC";

            var violations = await conn.QueryAsync<dynamic>(sql, new { StartDate = actualStart, EndDate = actualEnd });
            return Ok(violations);
        }
    }
}