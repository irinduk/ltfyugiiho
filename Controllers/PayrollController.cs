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

        [HttpGet("rates")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> GetActiveRates()
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
                var sql = @"
                    SELECT
                        pr.id,
                        pr.clearance_id as ClearanceId,
                        ct.name as ClearanceName,
                        pr.work_area_id as WorkAreaId,
                        pr.amount_per_shift as AmountPerShift,
                        TO_CHAR(pr.effective_from::date, 'YYYY-MM-DD') as EffectiveFrom,
                        pr.is_active as IsActive
                    FROM payroll_rates pr
                    JOIN clearance_types ct ON ct.id = pr.clearance_id
                    WHERE pr.is_active = true
                      AND pr.effective_from <= CURRENT_DATE
                    ORDER BY ct.name, pr.work_area_id NULLS FIRST, pr.effective_from DESC";
                var rates = await conn.QueryAsync<PayrollRateDto>(sql);
                return Ok(rates);
            }
            catch (PostgresException ex) when (ex.SqlState == "42P01")
            {
                return StatusCode(500, new { error = "Таблицы payroll еще не созданы. Примените SQL-скрипт миграции." });
            }
        }

        [HttpPost("rates")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> SetRate([FromBody] SetPayrollRateRequest request)
        {
            if (request.ClearanceId <= 0)
                return BadRequest(new { error = "Не указан допуск для тарифа" });
            if (request.AmountPerShift <= 0)
                return BadRequest(new { error = "Ставка за смену должна быть больше нуля" });

            try
            {
                using var conn = new NpgsqlConnection(_connectionString);
                await conn.OpenAsync();
                using var tx = await conn.BeginTransactionAsync();

                // 1) Проверим, что допуск существует
                var clsExists = await conn.ExecuteScalarAsync<bool>(
                    "SELECT EXISTS(SELECT 1 FROM clearance_types WHERE id = @Id)",
                    new { Id = request.ClearanceId },
                    tx
                );
                if (!clsExists)
                    return BadRequest(new { error = "Выбранный допуск не найден в справочнике" });

                // 2) Деактивируем прежний тариф для этой пары (clearance_id + work_area_id)
                var deactivateSql = @"
                    UPDATE payroll_rates
                    SET is_active = false
                    WHERE is_active = true
                      AND clearance_id = @ClearanceId
                      AND (
                           (work_area_id IS NULL AND @WorkAreaId IS NULL)
                        OR (work_area_id = @WorkAreaId)
                      )";
                await conn.ExecuteAsync(deactivateSql, new
                {
                    ClearanceId = request.ClearanceId,
                    WorkAreaId = string.IsNullOrWhiteSpace(request.WorkAreaId) ? null : request.WorkAreaId.Trim()
                }, tx);

                var sql = @"
                    INSERT INTO payroll_rates (clearance_id, work_area_id, amount_per_shift, effective_from, is_active)
                    VALUES (@ClearanceId, @WorkAreaId, @AmountPerShift, @EffectiveFrom, true)
                    RETURNING id";

                var id = await conn.ExecuteScalarAsync<int>(sql, new
                {
                    ClearanceId = request.ClearanceId,
                    WorkAreaId = string.IsNullOrWhiteSpace(request.WorkAreaId) ? null : request.WorkAreaId.Trim(),
                    request.AmountPerShift,
                    EffectiveFrom = request.EffectiveFrom?.Date ?? DateTime.UtcNow.Date
                }, tx);

                // Аудит: фиксируем создание/изменение тарифа
                var actor = User.FindFirst(ClaimTypes.Email)?.Value
                            ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                            ?? "Unknown";
                var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
                var action = $"PAYROLL_RATE_SET: clearanceId={request.ClearanceId}, workAreaId={(string.IsNullOrWhiteSpace(request.WorkAreaId) ? "ANY" : request.WorkAreaId)}, amount={request.AmountPerShift}, effectiveFrom={(request.EffectiveFrom?.Date ?? DateTime.UtcNow.Date):yyyy-MM-dd}";
                await conn.ExecuteAsync(
                    "INSERT INTO audit_logs (user_name, action, ip_address) VALUES (@UserName, @Action, @Ip)",
                    new { UserName = actor, Action = action, Ip = ip },
                    tx
                );

                await tx.CommitAsync();
                return Ok(new { id, message = "Тариф успешно сохранен" });
            }
            catch (PostgresException ex) when (ex.SqlState == "42P01")
            {
                return StatusCode(500, new { error = "Таблицы payroll еще не созданы. Примените SQL-скрипт миграции." });
            }
        }

        [HttpDelete("rates/{id:int}")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> DeleteRate(int id)
        {
            if (id <= 0) return BadRequest(new { error = "Некорректный id тарифа" });

            try
            {
                using var conn = new NpgsqlConnection(_connectionString);
                await conn.OpenAsync();
                using var tx = await conn.BeginTransactionAsync();

                var rate = await conn.QueryFirstOrDefaultAsync<DeleteRateDto>(@"
                    SELECT id,
                           clearance_id as ClearanceId,
                           work_area_id as WorkAreaId,
                           amount_per_shift as Amount,
                           TO_CHAR(effective_from::date, 'YYYY-MM-DD') as EffectiveFrom
                    FROM payroll_rates
                    WHERE id = @Id", new { Id = id }, tx);

                if (rate == null || rate.Id == 0) return NotFound(new { error = "Тариф не найден" });

                // Мягкое удаление: деактивация (история сохраняется)
                await conn.ExecuteAsync("UPDATE payroll_rates SET is_active = false WHERE id = @Id", new { Id = id }, tx);

                var actor = User.FindFirst(ClaimTypes.Email)?.Value
                            ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                            ?? "Unknown";
                var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
                var action = $"PAYROLL_RATE_DELETE: id={rate.Id}, clearanceId={rate.ClearanceId}, workAreaId={(string.IsNullOrWhiteSpace(rate.WorkAreaId) ? "ANY" : rate.WorkAreaId)}, amount={rate.Amount}, effectiveFrom={rate.EffectiveFrom}";
                await conn.ExecuteAsync(
                    "INSERT INTO audit_logs (user_name, action, ip_address) VALUES (@UserName, @Action, @Ip)",
                    new { UserName = actor, Action = action, Ip = ip },
                    tx
                );

                await tx.CommitAsync();
                return Ok(new { message = "Тариф удален (деактивирован)" });
            }
            catch (PostgresException ex) when (ex.SqlState == "42P01")
            {
                return StatusCode(500, new { error = "Таблицы payroll еще не созданы. Примените SQL-скрипт миграции." });
            }
        }

        [HttpGet("summary")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> GetPayrollSummary([FromQuery] DateTime startDate, [FromQuery] DateTime endDate)
        {
            if (startDate == default || endDate == default || endDate < startDate)
                return BadRequest(new { error = "Некорректный период отчета" });

            try
            {
                using var conn = new NpgsqlConnection(_connectionString);
                var sql = @"
                    WITH base_shifts AS (
                        SELECT
                            s.id as ShiftId,
                            s.employee_id as EmployeeId,
                            s.work_area_id as WorkAreaId,
                            s.shift_date::date as ShiftDate,
                            COALESCE(sof.is_overtime, FALSE) as IsOvertime,
                            CASE
                                WHEN s.end_time >= s.start_time THEN EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 3600.0
                                ELSE EXTRACT(EPOCH FROM ((s.end_time + INTERVAL '24 hours') - s.start_time)) / 3600.0
                            END as DurationHours
                        FROM shifts s
                        LEFT JOIN shift_overtime_flags sof ON sof.shift_id = s.id
                        WHERE s.shift_date::date >= @StartDate::date
                          AND s.shift_date::date <= @EndDate::date
                          AND COALESCE(s.status, 'Confirmed') = 'Confirmed'
                    ),
                    shifts_with_rates AS (
                        SELECT
                            bs.ShiftId,
                            bs.EmployeeId,
                            bs.WorkAreaId,
                            bs.ShiftDate,
                            bs.IsOvertime,
                            bs.DurationHours,
                            COALESCE(rate_pick.amount_per_shift, 0) as BaseRate
                        FROM base_shifts bs
                        LEFT JOIN LATERAL (
                            SELECT pr.amount_per_shift
                            FROM employee_clearances ec
                            JOIN payroll_rates pr ON pr.clearance_id = ec.clearance_id
                            WHERE ec.employee_id = bs.EmployeeId
                              AND pr.is_active = true
                              AND pr.effective_from <= bs.ShiftDate::date
                              AND (pr.work_area_id IS NULL OR pr.work_area_id = bs.WorkAreaId)
                            ORDER BY
                                CASE WHEN pr.work_area_id = bs.WorkAreaId THEN 0 ELSE 1 END,
                                pr.effective_from DESC,
                                pr.amount_per_shift DESC
                            LIMIT 1
                        ) rate_pick ON true
                    )
                    SELECT
                        e.id as EmployeeId,
                        TRIM(CONCAT_WS(' ', e.last_name, e.first_name, e.patronymic)) as EmployeeName,
                        COUNT(bs.ShiftId)::int as TotalShifts,
                        COALESCE(SUM(
                            CASE
                                WHEN swr.IsOvertime THEN
                                    (swr.BaseRate / 12.0) * (LEAST(swr.DurationHours, 2) * 1.5 + GREATEST(swr.DurationHours - 2, 0) * 2.0)
                                ELSE swr.BaseRate
                            END
                        ), 0)::numeric(14,2) as TotalSalary,
                        CASE
                            WHEN COUNT(bs.ShiftId) = 0 THEN 0::numeric(14,2)
                            ELSE ROUND(
                                COALESCE(SUM(
                                    CASE
                                        WHEN swr.IsOvertime THEN
                                            (swr.BaseRate / 12.0) * (LEAST(swr.DurationHours, 2) * 1.5 + GREATEST(swr.DurationHours - 2, 0) * 2.0)
                                        ELSE swr.BaseRate
                                    END
                                ), 0) / COUNT(bs.ShiftId),
                                2
                            )::numeric(14,2)
                        END as AvgShiftRate
                    FROM base_shifts bs
                    JOIN employees e ON e.id = bs.EmployeeId
                    LEFT JOIN shifts_with_rates swr ON swr.ShiftId = bs.ShiftId
                    GROUP BY e.id, e.last_name, e.first_name, e.patronymic
                    ORDER BY TotalSalary DESC, EmployeeName";

                var rows = await conn.QueryAsync<PayrollSummaryDto>(sql, new { StartDate = startDate.Date, EndDate = endDate.Date });
                return Ok(rows);
            }
            catch (PostgresException ex) when (ex.SqlState == "42P01")
            {
                return StatusCode(500, new { error = "Таблицы payroll еще не созданы. Примените SQL-скрипт миграции." });
            }
        }

        [HttpGet("monthly")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> CalculateMonthlyPayroll([FromQuery] int month, [FromQuery] int year)
        {
            if (month < 1 || month > 12)
                return BadRequest(new { error = "Некорректный месяц" });
            if (year < 2000 || year > 2100)
                return BadRequest(new { error = "Некорректный год" });

            var startDate = new DateTime(year, month, 1);
            var endDate = startDate.AddMonths(1).AddDays(-1);
            return await GetPayrollSummary(startDate, endDate);
        }
    }

    public class SetPayrollRateRequest
    {
        public int ClearanceId { get; set; }
        public string? WorkAreaId { get; set; }
        public decimal AmountPerShift { get; set; }
        public DateTime? EffectiveFrom { get; set; }
    }

    public class PayrollRateDto
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }

        [JsonPropertyName("clearanceId")]
        public int ClearanceId { get; set; }

        [JsonPropertyName("clearanceName")]
        public string ClearanceName { get; set; } = string.Empty;

        [JsonPropertyName("workAreaId")]
        public string? WorkAreaId { get; set; }

        [JsonPropertyName("amountPerShift")]
        public decimal AmountPerShift { get; set; }

        [JsonPropertyName("effectiveFrom")]
        public string EffectiveFrom { get; set; } = string.Empty;

        [JsonPropertyName("isActive")]
        public bool IsActive { get; set; }
    }

    public class PayrollSummaryDto
    {
        [JsonPropertyName("employeeId")]
        public Guid EmployeeId { get; set; }

        [JsonPropertyName("employeeName")]
        public string EmployeeName { get; set; } = string.Empty;

        [JsonPropertyName("totalShifts")]
        public int TotalShifts { get; set; }

        [JsonPropertyName("totalSalary")]
        public decimal TotalSalary { get; set; }

        [JsonPropertyName("avgShiftRate")]
        public decimal AvgShiftRate { get; set; }
    }

    public class DeleteRateDto
    {
        public int Id { get; set; }
        public int ClearanceId { get; set; }
        public string? WorkAreaId { get; set; }
        public decimal Amount { get; set; }
        public string EffectiveFrom { get; set; } = string.Empty;
    }
}
