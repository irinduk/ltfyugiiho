using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using System.Text.Json.Serialization;
using System.Security.Claims;

namespace NOC_Management_App.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class PayrollController : ControllerBase
    {
        private readonly string _connectionString;

        public PayrollController(IConfiguration config)
        {
            _connectionString = config.GetConnectionString("DefaultConnection")!;
        }

        [HttpGet("grades")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> GetGrades()
        {
            using var conn = new NpgsqlConnection(_connectionString);
            var grades = await conn.QueryAsync("SELECT id as Id, name as Name, level as Level FROM grades ORDER BY level");
            return Ok(grades);
        }

        [HttpGet("rates")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> GetActiveRates()
        {
            using var conn = new NpgsqlConnection(_connectionString);
            var sql = @"
                SELECT
                    pr.id,
                    pr.grade_id as GradeId,
                    g.name as GradeName,
                    pr.work_area_id as WorkAreaId,
                    pr.amount_per_shift as AmountPerShift,
                    pr.base_hours as BaseHours,
                    TO_CHAR(pr.effective_from::date, 'YYYY-MM-DD') as EffectiveFrom,
                    pr.is_active as IsActive
                FROM payroll_rates pr
                JOIN grades g ON g.id = pr.grade_id
                WHERE pr.is_active = true
                ORDER BY g.level DESC, pr.work_area_id NULLS FIRST";
            var rates = await conn.QueryAsync<PayrollRateDto>(sql);
            return Ok(rates);
        }

        [HttpPost("rates")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> SetRate([FromBody] SetPayrollRateRequest request)
        {
            if (request.GradeId <= 0) return BadRequest(new { error = "Не указан грейд" });
            if (request.AmountPerShift <= 0) return BadRequest(new { error = "Ставка должна быть > 0" });
            if (request.BaseHours <= 0) return BadRequest(new { error = "Базовые часы должны быть > 0" });

            using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();
            using var tx = await conn.BeginTransactionAsync();

            // Деактивируем старый тариф для этой пары (Грейд + Объект)
            var deactivateSql = @"
                UPDATE payroll_rates
                SET is_active = false
                WHERE is_active = true
                  AND grade_id = @GradeId
                  AND ((work_area_id IS NULL AND @WorkAreaId IS NULL) OR (work_area_id = @WorkAreaId))";

            await conn.ExecuteAsync(deactivateSql, new
            {
                request.GradeId,
                WorkAreaId = string.IsNullOrWhiteSpace(request.WorkAreaId) ? null : request.WorkAreaId.Trim()
            }, tx);

            var sql = @"
                INSERT INTO payroll_rates (grade_id, work_area_id, amount_per_shift, base_hours, effective_from, is_active)
                VALUES (@GradeId, @WorkAreaId, @AmountPerShift, @BaseHours, @EffectiveFrom, true)
                RETURNING id";

            var id = await conn.ExecuteScalarAsync<int>(sql, new
            {
                request.GradeId,
                WorkAreaId = string.IsNullOrWhiteSpace(request.WorkAreaId) ? null : request.WorkAreaId.Trim(),
                request.AmountPerShift,
                request.BaseHours,
                EffectiveFrom = request.EffectiveFrom?.Date ?? DateTime.UtcNow.Date
            }, tx);

            await tx.CommitAsync();
            return Ok(new { id, message = "Тариф успешно установлен" });
        }

        [HttpDelete("rates/{id:int}")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> DeleteRate(int id)
        {
            using var conn = new NpgsqlConnection(_connectionString);
            var rows = await conn.ExecuteAsync("UPDATE payroll_rates SET is_active = false WHERE id = @Id", new { Id = id });
            if (rows == 0) return NotFound();
            return Ok(new { message = "Тариф деактивирован" });
        }

        [HttpGet("summary")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> GetPayrollSummary([FromQuery] DateTime startDate, [FromQuery] DateTime endDate, [FromQuery] string? workAreaId = null, [FromQuery] int? gradeId = null)
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
                WITH base_shifts AS (
                    SELECT
                        s.id as ShiftId,
                        s.employee_id as EmployeeId,
                        e.grade_id as GradeId,
                        s.work_area_id as WorkAreaId,
                        s.shift_date::date as ShiftDate,
                        COALESCE(sof.is_overtime, FALSE) as IsOvertime,
                        CASE
                            WHEN s.start_time IS NOT NULL AND s.end_time IS NOT NULL THEN
                                CASE
                                    WHEN s.end_time >= s.start_time THEN EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0
                                    ELSE EXTRACT(EPOCH FROM ((s.end_time + INTERVAL '24 hours') - s.start_time)) / 3600.0
                                END
                            WHEN COALESCE(s.shift_type, 'Day') IN ('Day', 'Night') THEN 12.0
                            ELSE 0.0
                        END as DurationHours
                    FROM shifts s
                    JOIN employees e ON e.id = s.employee_id
                    LEFT JOIN shift_overtime_flags sof ON sof.shift_id = s.id
                    WHERE s.shift_date::date >= @StartDate::date
                      AND s.shift_date::date <= @EndDate::date
                      AND COALESCE(s.status, 'Confirmed') = 'Confirmed'
                      AND (@WorkAreaId IS NULL OR s.work_area_id = @WorkAreaId)
                      AND (@GradeId IS NULL OR e.grade_id = @GradeId)
                ),
                calculated_shifts AS (
                    SELECT
                        bs.EmployeeId,
                        bs.ShiftId,
                        bs.DurationHours,
                        COALESCE(
                            (SELECT pr.amount_per_shift / NULLIF(pr.base_hours, 0)
                             FROM payroll_rates pr
                             WHERE pr.grade_id = bs.GradeId
                               AND pr.is_active = true
                               AND pr.effective_from <= bs.ShiftDate
                               AND (pr.work_area_id IS NULL OR pr.work_area_id = bs.WorkAreaId)
                             ORDER BY (pr.work_area_id = bs.WorkAreaId) DESC, pr.effective_from DESC
                             LIMIT 1), 0
                        ) as HourlyRate,
                        bs.IsOvertime,
                        CASE WHEN bs.IsOvertime THEN LEAST(bs.DurationHours, 2.0) ELSE 0 END as OvertimeFirstHours,
                        CASE WHEN bs.IsOvertime THEN GREATEST(bs.DurationHours - 2.0, 0) ELSE 0 END as OvertimeNextHours
                    FROM base_shifts bs
                )
                SELECT
                    e.id as EmployeeId,
                    TRIM(CONCAT_WS(' ', e.last_name, e.first_name, e.patronymic)) as EmployeeName,
                    g.name as GradeName,
                    COUNT(cs.ShiftId)::int as TotalShifts,
                    COALESCE(SUM(cs.DurationHours), 0)::numeric(14,2) as TotalHours,
                    COALESCE(SUM(cs.OvertimeFirstHours + cs.OvertimeNextHours), 0)::numeric(14,2) as OvertimeHours,
                    COALESCE(SUM(
                        CASE 
                            WHEN cs.IsOvertime THEN
                                (cs.HourlyRate * cs.OvertimeFirstHours * 1.5) +
                                (cs.HourlyRate * cs.OvertimeNextHours * 2.0)
                            ELSE cs.HourlyRate * cs.DurationHours 
                        END
                    ), 0)::numeric(14,2) as TotalSalary
                FROM employees e
                LEFT JOIN grades g ON g.id = e.grade_id
                LEFT JOIN calculated_shifts cs ON cs.EmployeeId = e.id
                GROUP BY e.id, e.last_name, e.first_name, e.patronymic, g.name
                HAVING COUNT(cs.ShiftId) > 0
                ORDER BY TotalSalary DESC";

            var summary = await conn.QueryAsync<PayrollSummaryDto>(sql, new
            {
                StartDate = startDate.Date,
                EndDate = endDate.Date,
                WorkAreaId = string.IsNullOrWhiteSpace(workAreaId) ? null : workAreaId.Trim(),
                GradeId = gradeId
            });
            return Ok(summary);
        }
    }

    public class SetPayrollRateRequest
    {
        public int GradeId { get; set; }
        public string? WorkAreaId { get; set; }
        public decimal AmountPerShift { get; set; }
        public decimal BaseHours { get; set; } = 12.0m;
        public DateTime? EffectiveFrom { get; set; }
    }

    public class PayrollRateDto
    {
        [JsonPropertyName("id")] public int Id { get; set; }
        [JsonPropertyName("gradeId")] public int GradeId { get; set; }
        [JsonPropertyName("gradeName")] public string GradeName { get; set; } = "";
        [JsonPropertyName("workAreaId")] public string? WorkAreaId { get; set; }
        [JsonPropertyName("amountPerShift")] public decimal AmountPerShift { get; set; }
        [JsonPropertyName("baseHours")] public decimal BaseHours { get; set; }
        [JsonPropertyName("effectiveFrom")] public string EffectiveFrom { get; set; } = "";
        [JsonPropertyName("isActive")] public bool IsActive { get; set; }
    }

    public class PayrollSummaryDto
    {
        [JsonPropertyName("employeeId")] public Guid EmployeeId { get; set; }
        [JsonPropertyName("employeeName")] public string EmployeeName { get; set; } = "";
        [JsonPropertyName("gradeName")] public string? GradeName { get; set; }
        [JsonPropertyName("totalShifts")] public int TotalShifts { get; set; }
        [JsonPropertyName("totalHours")] public decimal TotalHours { get; set; }
        [JsonPropertyName("overtimeHours")] public decimal OvertimeHours { get; set; }
        [JsonPropertyName("totalSalary")] public decimal TotalSalary { get; set; }
    }
}