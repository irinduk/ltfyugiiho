using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Npgsql;
using Dapper;
using NOC_Management_App.Models;

namespace NOC_Management_App.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ShiftsController : ControllerBase
    {
        private readonly string _connectionString;

        public ShiftsController(IConfiguration config)
        {
            _connectionString = config.GetConnectionString("DefaultConnection")!;
        }

        [HttpGet]
        public async Task<IActionResult> GetShifts()
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
                    ORDER BY shift_date DESC";

                var shifts = await conn.QueryAsync<ShiftListItemDto>(sql);
                return Ok(shifts);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Ошибка загрузки смен", details = ex.Message });
            }
        }

        [HttpPost]
        public async Task<IActionResult> AssignShift([FromBody] CreateShiftRequest request)
        {
            if (request.EmployeeId == Guid.Empty)
                return BadRequest(new { error = "Не указан сотрудник" });
            if (string.IsNullOrWhiteSpace(request.WorkAreaId))
                return BadRequest(new { error = "Не указан объект/зона" });
            if (request.ShiftDate == default)
                return BadRequest(new { error = "Не указана дата смены" });

            try
            {
                var shift = new Shift
                {
                    EmployeeId = request.EmployeeId,
                    WorkAreaId = request.WorkAreaId.Trim(),
                    ShiftDate = request.ShiftDate.Date,
                    ShiftType = string.IsNullOrWhiteSpace(request.ShiftType) ? "Day" : request.ShiftType,
                    Status = string.IsNullOrWhiteSpace(request.Status) ? "Confirmed" : request.Status
                };

                TimeSpan? parsedStart = null;
                TimeSpan? parsedEnd = null;
                if (!string.IsNullOrWhiteSpace(request.StartTime))
                {
                    if (!TimeSpan.TryParse(request.StartTime, out var ts))
                        return BadRequest(new { error = "Некорректный формат startTime, ожидается HH:mm или HH:mm:ss" });
                    parsedStart = ts;
                }
                if (!string.IsNullOrWhiteSpace(request.EndTime))
                {
                    if (!TimeSpan.TryParse(request.EndTime, out var ts))
                        return BadRequest(new { error = "Некорректный формат endTime, ожидается HH:mm или HH:mm:ss" });
                    parsedEnd = ts;
                }

                shift.StartTime = parsedStart;
                shift.EndTime = parsedEnd;
                if (shift.StartTime == null || shift.EndTime == null)
                {
                    if (shift.ShiftType == "Day")
                    {
                        shift.StartTime = new TimeSpan(8, 0, 0);
                        shift.EndTime = new TimeSpan(20, 0, 0);
                    }
                    else if (shift.ShiftType == "Night")
                    {
                        shift.StartTime = new TimeSpan(20, 0, 0);
                        shift.EndTime = new TimeSpan(8, 0, 0);
                    }
                }

                if (shift.StartTime == null || shift.EndTime == null)
                    return BadRequest(new { error = "Не указано время начала/окончания смены" });

                var day = shift.ShiftDate.Date;

                using var conn = new NpgsqlConnection(_connectionString);
                await conn.OpenAsync();

                await conn.ExecuteAsync(@"
                CREATE TABLE IF NOT EXISTS shift_overtime_flags (
                    shift_id UUID PRIMARY KEY REFERENCES shifts(id) ON DELETE CASCADE,
                    is_overtime BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                )");

                var hasSameDayShift = await conn.ExecuteScalarAsync<bool>(@"
                SELECT EXISTS(
                    SELECT 1
                    FROM shifts
                    WHERE employee_id = @EmployeeId
                      AND shift_date::date = @Day::date
                )", new { shift.EmployeeId, Day = day });

                if (hasSameDayShift && !request.IsOvertime)
                    return BadRequest(new { error = "У сотрудника уже есть смена в этот день. Дополнительная смена допускается только как переработка." });

                try
                {
                    var overlappingLeaveType = await conn.ExecuteScalarAsync<string?>(@"
                        SELECT COALESCE(v.leave_type, 'Annual')
                        FROM vacations v
                        WHERE v.employee_id = @EmployeeId
                          AND v.status = 'Approved'
                          AND v.start_date <= @Day::date
                          AND v.end_date >= @Day::date
                        ORDER BY v.start_date DESC
                        LIMIT 1", new { shift.EmployeeId, Day = day });

                    if (!string.IsNullOrWhiteSpace(overlappingLeaveType))
                    {
                        if (overlappingLeaveType == "Unpaid")
                            return BadRequest(new { error = "Нельзя назначить смену: у сотрудника отгул за свой счет на эту дату" });
                        return BadRequest(new { error = "Нельзя назначить смену: сотрудник находится в утвержденном отпуске" });
                    }
                }
                catch (PostgresException ex) when (ex.SqlState == "42P01") { }

                var dow = (int)day.DayOfWeek;
                var mondayOffset = dow == 0 ? -6 : 1 - dow;
                var weekStart = day.AddDays(mondayOffset).Date;
                var weekEnd = weekStart.AddDays(6).Date;

                var existingSql = @"
                SELECT TO_CHAR(shift_date::date, 'YYYY-MM-DD') as ShiftDate,
                       shift_type as ShiftType,
                       TO_CHAR(start_time, 'HH24:MI:SS') as StartTime,
                       TO_CHAR(end_time, 'HH24:MI:SS') as EndTime
                FROM shifts
                WHERE employee_id = @EmployeeId
                  AND shift_date::date >= @WeekStart::date
                  AND shift_date::date <= @WeekEnd::date
                  AND COALESCE(status, 'Confirmed') IN ('Confirmed', 'PendingSwap')
                ORDER BY shift_date ASC, start_time ASC";

                var existing = (await conn.QueryAsync<ShiftWindowDto>(existingSql, new
                {
                    shift.EmployeeId,
                    WeekStart = weekStart,
                    WeekEnd = weekEnd
                })).ToList();

                static TimeSpan ParseTime(string? value)
                {
                    if (!TimeSpan.TryParse(value, out var parsed))
                        return TimeSpan.Zero;
                    return parsed;
                }

                static double DurationHours(TimeSpan start, TimeSpan end)
                {
                    var diff = (end - start).TotalHours;
                    if (diff < 0) diff += 24;
                    return diff;
                }

                var newHours = DurationHours(shift.StartTime.Value, shift.EndTime.Value);
                if (newHours > 12.0 + 1e-9)
                    return BadRequest(new { error = "Нельзя назначить смену длительностью более 12 часов" });
                var totalWeekHours = existing.Sum(x => DurationHours(ParseTime(x.StartTime), ParseTime(x.EndTime))) + newHours;

                if (!request.IsOvertime)
                {
                    // 6-я смена подряд допускается только как переработка.
                    var consecutiveSql = @"
                        SELECT TO_CHAR(shift_date::date, 'YYYY-MM-DD') as ShiftDate
                        FROM shifts
                        WHERE employee_id = @EmployeeId
                          AND shift_date::date BETWEEN @From::date AND @To::date
                          AND COALESCE(status, 'Confirmed') IN ('Confirmed', 'PendingSwap')";
                    var recentShiftDays = (await conn.QueryAsync<string>(consecutiveSql, new
                    {
                        shift.EmployeeId,
                        From = day.AddDays(-14),
                        To = day
                    })).ToHashSet();
                    recentShiftDays.Add(day.ToString("yyyy-MM-dd"));

                    var streak = 0;
                    for (var d = day; recentShiftDays.Contains(d.ToString("yyyy-MM-dd")); d = d.AddDays(-1))
                    {
                        streak++;
                    }
                    if (streak >= 6)
                        return BadRequest(new { error = "Нарушение ТК РФ: смена возможна только в режиме переработки" });

                    if (totalWeekHours > 40.0 + 1e-9)
                        return BadRequest(new { error = "Нарушение ТК РФ: превышение 40 часов работы в неделю" });
                }

                // Еженедельный непрерывный отдых >= 42 часа (для обычного режима).
                var weekRangeSql = @"
                    SELECT TO_CHAR(shift_date::date, 'YYYY-MM-DD') as ShiftDate,
                           TO_CHAR(start_time, 'HH24:MI:SS') as StartTime,
                           TO_CHAR(end_time, 'HH24:MI:SS') as EndTime
                    FROM shifts
                    WHERE employee_id = @EmployeeId
                      AND shift_date::date BETWEEN @From::date AND @To::date
                      AND COALESCE(status, 'Confirmed') IN ('Confirmed', 'PendingSwap')
                    ORDER BY shift_date ASC, start_time ASC";

                var weekWindows = (await conn.QueryAsync<ShiftWindowDto>(weekRangeSql, new
                {
                    shift.EmployeeId,
                    From = weekStart.AddDays(-1),
                    To = weekEnd.AddDays(1)
                })).ToList();

                var periodStart = weekStart;
                var periodEnd = weekEnd.AddDays(1);
                var intervals = new List<(DateTime Start, DateTime End)>();
                foreach (var w in weekWindows)
                {
                    if (!DateTime.TryParse(w.ShiftDate, out var shiftDate))
                        continue;
                    var startTs = ParseTime(w.StartTime);
                    var endTs = ParseTime(w.EndTime);
                    var s = shiftDate.Date.Add(startTs);
                    var e = shiftDate.Date.Add(endTs);
                    if (endTs < startTs) e = e.AddDays(1);
                    if (e <= periodStart || s >= periodEnd) continue;
                    if (s < periodStart) s = periodStart;
                    if (e > periodEnd) e = periodEnd;
                    intervals.Add((s, e));
                }
                var newIntStart = day.Add(shift.StartTime.Value);
                var newIntEnd = day.Add(shift.EndTime.Value);
                if (shift.EndTime.Value < shift.StartTime.Value) newIntEnd = newIntEnd.AddDays(1);
                if (newIntEnd > periodStart && newIntStart < periodEnd)
                {
                    if (newIntStart < periodStart) newIntStart = periodStart;
                    if (newIntEnd > periodEnd) newIntEnd = periodEnd;
                    intervals.Add((newIntStart, newIntEnd));
                }

                intervals = intervals.OrderBy(x => x.Start).ToList();
                var merged = new List<(DateTime Start, DateTime End)>();
                foreach (var interval in intervals)
                {
                    if (merged.Count == 0 || interval.Start > merged[^1].End)
                        merged.Add(interval);
                    else if (interval.End > merged[^1].End)
                        merged[^1] = (merged[^1].Start, interval.End);
                }

                var maxRest = 0.0;
                var cursor = periodStart;
                foreach (var m in merged)
                {
                    if (m.Start > cursor)
                        maxRest = Math.Max(maxRest, (m.Start - cursor).TotalHours);
                    if (m.End > cursor) cursor = m.End;
                }
                if (periodEnd > cursor)
                    maxRest = Math.Max(maxRest, (periodEnd - cursor).TotalHours);

                if (!request.IsOvertime && maxRest < 42.0)
                    return BadRequest(new { error = $"Нарушение ТК РФ: еженедельный непрерывный отдых должен быть не менее 42 часов (фактически {Math.Round(maxRest, 1)} ч). Включите режим переработки для назначения такой смены." });

                var prevNextSql = @"
                SELECT TO_CHAR(shift_date::date, 'YYYY-MM-DD') as ShiftDate,
                       TO_CHAR(start_time, 'HH24:MI:SS') as StartTime,
                       TO_CHAR(end_time, 'HH24:MI:SS') as EndTime
                FROM shifts
                WHERE employee_id = @EmployeeId
                  AND shift_date::date BETWEEN @From::date AND @To::date
                  AND COALESCE(status, 'Confirmed') IN ('Confirmed', 'PendingSwap')
                ORDER BY shift_date ASC, start_time ASC";

                var around = (await conn.QueryAsync<ShiftWindowDto>(prevNextSql, new
                {
                    shift.EmployeeId,
                    From = day.AddDays(-1),
                    To = day.AddDays(1)
                })).ToList();

                DateTime NewStartDt() => day.Add(shift.StartTime.Value);
                DateTime NewEndDt()
                {
                    var end = day.Add(shift.EndTime.Value);
                    if (shift.EndTime.Value < shift.StartTime.Value) end = end.AddDays(1);
                    return end;
                }

                var newStart = NewStartDt();
                var newEnd = NewEndDt();

                foreach (var ex in around)
                {
                    if (!DateTime.TryParse(ex.ShiftDate, out var exDay))
                        continue;
                    var exStartTime = ParseTime(ex.StartTime);
                    var exEndTime = ParseTime(ex.EndTime);
                    var exStart = exDay.Date.Add(exStartTime);
                    var exEnd = exDay.Date.Add(exEndTime);
                    if (exEndTime < exStartTime) exEnd = exEnd.AddDays(1);

                if (exEnd <= newStart)
                {
                    var rest = (newStart - exEnd).TotalHours;
                    if (!request.IsOvertime && rest < 12)
                        return BadRequest(new { error = $"Нарушение ТК РФ: недостаточно времени для ежедневного отдыха (нужно ≥ 12 часов, фактически {Math.Round(rest, 1)} ч)." });
                }
                if (newEnd <= exStart)
                {
                    var rest = (exStart - newEnd).TotalHours;
                    if (!request.IsOvertime && rest < 12)
                        return BadRequest(new { error = $"Нарушение ТК РФ: недостаточно времени для ежедневного отдыха (нужно ≥ 12 часов, фактически {Math.Round(rest, 1)} ч)." });
                }
                }

                var sql = @"
                INSERT INTO shifts (employee_id, work_area_id, shift_date, shift_type, start_time, end_time, status)
                VALUES (@EmployeeId, @WorkAreaId, @ShiftDate, @ShiftType, @StartTime, @EndTime, @Status)
                RETURNING id";

                var id = await conn.ExecuteScalarAsync<Guid>(sql, shift);
                shift.Id = id;
                if (request.IsOvertime)
                {
                    await conn.ExecuteAsync(
                        "INSERT INTO shift_overtime_flags (shift_id, is_overtime) VALUES (@ShiftId, TRUE) ON CONFLICT (shift_id) DO UPDATE SET is_overtime = EXCLUDED.is_overtime",
                        new { ShiftId = id }
                    );
                }

                return Ok(new
                {
                    shift.Id,
                    shift.EmployeeId,
                    shift.WorkAreaId,
                    shift.ShiftDate,
                    shift.ShiftType,
                    shift.StartTime,
                    shift.EndTime,
                    shift.Status,
                    IsOvertime = request.IsOvertime
                });
            }
            catch (PostgresException ex) when (ex.SqlState == "23514" || ex.SqlState == "23505" || ex.SqlState == "22007")
            {
                return BadRequest(new { error = $"Не удалось сохранить смену: {ex.MessageText}" });
            }
            catch (PostgresException ex)
            {
                return StatusCode(500, new { error = $"Ошибка БД при назначении смены: {ex.MessageText}" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = $"Ошибка при назначении смены: {ex.Message}" });
            }
        }

        [HttpPatch("{id}/status")]
        public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] StatusUpdateRequest request)
        {
            if (string.IsNullOrEmpty(request.Status))
                return BadRequest(new { error = "Статус не может быть пустым" });

            using var conn = new NpgsqlConnection(_connectionString);
            var sql = "UPDATE shifts SET status = @status, updated_at = CURRENT_TIMESTAMP WHERE id = @id";

            var rowsAffected = await conn.ExecuteAsync(sql, new { id, status = request.Status });

            if (rowsAffected == 0)
                return NotFound(new { error = "Смена не найдена" });

            return Ok(new { message = "Статус успешно обновлен" });
        }

        [HttpPatch("{id}/reassign")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> ReassignShift(Guid id, [FromBody] ReassignShiftRequest request)
        {
            if (request.TargetEmployeeId == Guid.Empty)
                return BadRequest(new { error = "Не указан новый исполнитель смены" });

            using var conn = new NpgsqlConnection(_connectionString);
            var sql = @"
                UPDATE shifts
                SET employee_id = @TargetEmployeeId,
                    status = 'Confirmed',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = @id";

            var rowsAffected = await conn.ExecuteAsync(sql, new { id, request.TargetEmployeeId });
            if (rowsAffected == 0)
                return NotFound(new { error = "Смена не найдена" });

            return Ok(new { message = "Смена успешно переназначена" });
        }

        // НОВЫЙ ЭНДПОИНТ ДЛЯ УДАЛЕНИЯ СМЕНЫ
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> DeleteShift(Guid id)
        {
            using var conn = new NpgsqlConnection(_connectionString);
            var sql = "DELETE FROM shifts WHERE id = @id";

            var rowsAffected = await conn.ExecuteAsync(sql, new { id });

            if (rowsAffected == 0)
                return NotFound(new { error = "Смена не найдена" });

            return Ok(new { message = "Смена успешно удалена" });
        }
    }

    public class StatusUpdateRequest
    {
        public string? Status { get; set; }
    }

    public class ReassignShiftRequest
    {
        public Guid TargetEmployeeId { get; set; }
    }

    public class CreateShiftRequest
    {
        public Guid EmployeeId { get; set; }
        public string WorkAreaId { get; set; } = string.Empty;
        public DateTime ShiftDate { get; set; }
        public string ShiftType { get; set; } = "Day";
        public string? StartTime { get; set; }
        public string? EndTime { get; set; }
        public string? Status { get; set; }
        public bool IsOvertime { get; set; }
    }

    internal class ShiftWindowDto
    {
        public string ShiftDate { get; set; } = "";
        public string StartTime { get; set; } = "";
        public string EndTime { get; set; } = "";
        public string ShiftType { get; set; } = "";
    }
}