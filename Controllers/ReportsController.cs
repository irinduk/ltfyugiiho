using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Npgsql;
using Dapper;
using System.Security.Claims;
using System.Text.Json.Serialization;

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
                WITH shift_base AS (
                    SELECT
                        s.id as ShiftId,
                        s.employee_id as EmployeeId,
                        TRIM(CONCAT_WS(' ', e.last_name, e.first_name, e.patronymic)) as EmployeeName,
                        COALESCE(g.name, 'Без грейда') as GradeName,
                        COALESCE(s.shift_type, 'Day') as ShiftType,
                        COALESCE(s.status, 'Confirmed') as ShiftStatus,
                        COALESCE(sof.is_overtime, FALSE) as IsOvertime,
                        s.work_area_id as WorkAreaId,
                        s.shift_date::date as ShiftDate,
                        CASE
                            WHEN s.start_time IS NOT NULL AND s.end_time IS NOT NULL THEN
                                CASE
                                    WHEN s.end_time >= s.start_time THEN EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0
                                    ELSE EXTRACT(EPOCH FROM ((s.end_time + INTERVAL '24 hours') - s.start_time)) / 3600.0
                                END
                            WHEN COALESCE(s.shift_type, 'Day') IN ('Day', 'Night') THEN 12.0
                            ELSE 0.0
                        END as DurationHours,
                        COALESCE(
                            (
                                SELECT pr.amount_per_shift / NULLIF(pr.base_hours, 0)
                                FROM payroll_rates pr
                                WHERE pr.grade_id = e.grade_id
                                  AND pr.is_active = true
                                  AND pr.effective_from <= s.shift_date::date
                                  AND (pr.work_area_id IS NULL OR pr.work_area_id = s.work_area_id)
                                ORDER BY
                                    CASE WHEN pr.work_area_id = s.work_area_id THEN 0 ELSE 1 END,
                                    pr.effective_from DESC
                                LIMIT 1
                            ),
                            0
                        ) as HourlyRate
                    FROM shifts s
                    JOIN employees e ON e.id = s.employee_id
                    LEFT JOIN grades g ON g.id = e.grade_id
                    LEFT JOIN shift_overtime_flags sof ON sof.shift_id = s.id
                    WHERE s.shift_date::date >= @StartDate::date
                      AND s.shift_date::date <= @EndDate::date
                ),
                shift_calc AS (
                    SELECT
                        sb.*,
                        CASE WHEN sb.IsOvertime THEN LEAST(sb.DurationHours, 2.0) ELSE 0.0 END as OvertimeFirstHours,
                        CASE WHEN sb.IsOvertime THEN GREATEST(sb.DurationHours - 2.0, 0.0) ELSE 0.0 END as OvertimeNextHours
                    FROM shift_base sb
                )
                SELECT
                    EmployeeId,
                    EmployeeName,
                    GradeName,
                    COUNT(ShiftId)::int as PlanShifts,
                    COUNT(CASE WHEN ShiftStatus = 'Confirmed' THEN 1 END)::int as FactShifts,
                    COUNT(CASE WHEN ShiftType = 'Day' THEN 1 END)::int as DayShifts,
                    COUNT(CASE WHEN ShiftType = 'Night' THEN 1 END)::int as NightShifts,
                    COALESCE(SUM(DurationHours), 0)::numeric(14,2) as TotalHours,
                    COALESCE(SUM(OvertimeFirstHours + OvertimeNextHours), 0)::numeric(14,2) as OvertimeHours,
                    COALESCE(SUM(
                        CASE
                            WHEN IsOvertime THEN
                                (HourlyRate * OvertimeFirstHours * 1.5) +
                                (HourlyRate * OvertimeNextHours * 2.0)
                            ELSE HourlyRate * DurationHours
                        END
                    ), 0)::numeric(14,2) as TotalSalary
                FROM shift_calc
                GROUP BY EmployeeId, EmployeeName, GradeName
                ORDER BY EmployeeName";

            var rows = (await conn.QueryAsync<ShiftEmployeeReportRow>(sql, new
            {
                StartDate = startDate.Date,
                EndDate = endDate.Date
            })).ToList();

            var kpi = new ShiftReportKpi
            {
                TotalShifts = rows.Sum(x => x.FactShifts),
                TotalHours = rows.Sum(x => x.TotalHours),
                OvertimeHours = rows.Sum(x => x.OvertimeHours),
                TotalSwaps = await conn.ExecuteScalarAsync<int>(@"
                    SELECT COUNT(*)
                    FROM audit_logs al
                    WHERE al.timestamp >= @StartDate::date
                      AND al.timestamp < (@EndDate::date + INTERVAL '1 day')
                      AND (
                            al.action ILIKE 'SHIFT_SWAP_APPROVED:%'
                         OR al.action ILIKE 'Замена смены % утверждена%'
                      )", new
                {
                    StartDate = startDate.Date,
                    EndDate = endDate.Date
                })
            };

            return Ok(new ShiftSummaryReportResponse
            {
                Kpi = kpi,
                Employees = rows
            });
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

        [HttpGet("vacations-summary")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> GetVacationsSummary([FromQuery] DateTime startDate, [FromQuery] DateTime endDate)
        {
            if (startDate == default || endDate == default || endDate < startDate)
                return BadRequest(new { error = "Некорректный период отчета" });

            using var conn = new NpgsqlConnection(_connectionString);
            var sql = @"
                SELECT
                    TRIM(CONCAT_WS(' ', e.last_name, e.first_name, e.patronymic)) as EmployeeName,
                    TO_CHAR(v.start_date::date, 'YYYY-MM-DD') as VacationStart,
                    TO_CHAR(v.end_date::date, 'YYYY-MM-DD') as VacationEnd,
                    COALESCE(v.leave_type, 'Annual') as LeaveType,
                    v.status as Status
                FROM vacations v
                JOIN employees e ON e.id = v.employee_id
                WHERE v.start_date::date <= @EndDate::date
                  AND v.end_date::date >= @StartDate::date
                ORDER BY v.start_date, EmployeeName";
            var rows = await conn.QueryAsync<dynamic>(sql, new { StartDate = startDate.Date, EndDate = endDate.Date });
            return Ok(rows);
        }

        [HttpGet("overtime-summary")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> GetOvertimeSummary([FromQuery] DateTime startDate, [FromQuery] DateTime endDate)
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
                    TRIM(CONCAT_WS(' ', e.last_name, e.first_name, e.patronymic)) as EmployeeName,
                    TO_CHAR(s.shift_date::date, 'YYYY-MM-DD') as ShiftDate,
                    s.work_area_id as WorkAreaId,
                    TO_CHAR(s.start_time, 'HH24:MI:SS') as StartTime,
                    TO_CHAR(s.end_time, 'HH24:MI:SS') as EndTime,
                    (
                        CASE
                            WHEN s.end_time >= s.start_time THEN EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0
                            ELSE EXTRACT(EPOCH FROM ((s.end_time + INTERVAL '24 hours') - s.start_time)) / 3600.0
                        END
                    )::numeric(10,2) as OvertimeHours
                FROM shifts s
                JOIN employees e ON e.id = s.employee_id
                JOIN shift_overtime_flags sof ON sof.shift_id = s.id AND sof.is_overtime = TRUE
                WHERE s.shift_date::date >= @StartDate::date
                  AND s.shift_date::date <= @EndDate::date
                  AND COALESCE(s.status, 'Confirmed') = 'Confirmed'
                ORDER BY s.shift_date, EmployeeName";
            var rows = await conn.QueryAsync<dynamic>(sql, new { StartDate = startDate.Date, EndDate = endDate.Date });
            return Ok(rows);
        }
    }

    public class ShiftReportKpi
    {
        [JsonPropertyName("totalShifts")] public int TotalShifts { get; set; }
        [JsonPropertyName("totalHours")] public decimal TotalHours { get; set; }
        [JsonPropertyName("overtimeHours")] public decimal OvertimeHours { get; set; }
        [JsonPropertyName("totalSwaps")] public int TotalSwaps { get; set; }
    }

    public class ShiftEmployeeReportRow
    {
        [JsonPropertyName("employeeId")] public Guid EmployeeId { get; set; }
        [JsonPropertyName("employeeName")] public string EmployeeName { get; set; } = "";
        [JsonPropertyName("gradeName")] public string GradeName { get; set; } = "";
        [JsonPropertyName("planShifts")] public int PlanShifts { get; set; }
        [JsonPropertyName("factShifts")] public int FactShifts { get; set; }
        [JsonPropertyName("dayShifts")] public int DayShifts { get; set; }
        [JsonPropertyName("nightShifts")] public int NightShifts { get; set; }
        [JsonPropertyName("totalHours")] public decimal TotalHours { get; set; }
        [JsonPropertyName("overtimeHours")] public decimal OvertimeHours { get; set; }
        [JsonPropertyName("totalSalary")] public decimal TotalSalary { get; set; }
    }

    public class ShiftSummaryReportResponse
    {
        [JsonPropertyName("kpi")] public ShiftReportKpi Kpi { get; set; } = new();
        [JsonPropertyName("employees")] public List<ShiftEmployeeReportRow> Employees { get; set; } = new();
    }
}