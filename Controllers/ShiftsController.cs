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

            var shift = new Shift
            {
                EmployeeId = request.EmployeeId,
                WorkAreaId = request.WorkAreaId.Trim(),
                ShiftDate = request.ShiftDate.Date,
                ShiftType = string.IsNullOrWhiteSpace(request.ShiftType) ? "Day" : request.ShiftType,
                Status = string.IsNullOrWhiteSpace(request.Status) ? "Confirmed" : request.Status
            };

            // Если время не передали, задаем базовые окна (нужно для расчета часов/валидаций).
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
                    shift.EndTime = new TimeSpan(8, 0, 0); // через полночь
                }
            }

            if (shift.StartTime == null || shift.EndTime == null)
                return BadRequest(new { error = "Не указано время начала/окончания смены" });

            var day = shift.ShiftDate.Date;

            using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync();

            // Служебная таблица флагов переработки (создается автоматически).
            await conn.ExecuteAsync(@"
                CREATE TABLE IF NOT EXISTS shift_overtime_flags (
                    shift_id UUID PRIMARY KEY REFERENCES shifts(id) ON DELETE CASCADE,
                    is_overtime BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                )");

            // Одна обычная смена в день: вторую можно добавить только как переработку.
            var hasSameDayShift = await conn.ExecuteScalarAsync<bool>(@"
                SELECT EXISTS(
                    SELECT 1
                    FROM shifts
                    WHERE employee_id = @EmployeeId
                      AND shift_date::date = @Day::date
                )", new { shift.EmployeeId, Day = day });
            if (hasSameDayShift && !request.IsOvertime)
                return BadRequest(new { error = "У сотрудника уже есть смена в этот день. Дополнительная смена допускается только как переработка." });

            // Запрет назначения смены в утвержденный отпуск.
            // Если модуль отпусков еще не применен в БД (таблица vacations отсутствует),
            // не валим создание смены 500-кой, а просто пропускаем проверку.
            try
            {
                var vacationOverlap = await conn.ExecuteScalarAsync<bool>(@"
                    SELECT EXISTS(
                        SELECT 1
                        FROM vacations v
                        WHERE v.employee_id = @EmployeeId
                          AND v.status = 'Approved'
                          AND v.start_date <= @Day::date
                          AND v.end_date >= @Day::date
                    )", new { shift.EmployeeId, Day = day });
                if (vacationOverlap)
                    return BadRequest(new { error = "Нельзя назначить смену: сотрудник находится в утвержденном отпуске" });
            }
            catch (PostgresException ex) when (ex.SqlState == "42P01")
            {
                // Таблица vacations пока не создана.
            }

            // Валидация ТК РФ: не более 40 часов в неделю + минимум 12 часов отдыха между сменами.
            // Неделя: понедельник-воскресенье (ISO-like).
            var dow = (int)day.DayOfWeek; // Sunday=0
            var mondayOffset = dow == 0 ? -6 : 1 - dow;
            var weekStart = day.AddDays(mondayOffset);
            var weekEnd = weekStart.AddDays(6);

            var existingSql = @"
                SELECT (shift_date::date)::timestamp as ShiftDate,
                       shift_type as ShiftType,
                       start_time as StartTime,
                       end_time as EndTime
                FROM shifts
                WHERE employee_id = @EmployeeId
                  AND shift_date::date >= @WeekStart
                  AND shift_date::date <= @WeekEnd
                  AND COALESCE(status, 'Confirmed') = 'Confirmed'
                ORDER BY shift_date ASC, start_time ASC";

            var existing = (await conn.QueryAsync<ShiftWindowDto>(existingSql, new
            {
                shift.EmployeeId,
                WeekStart = weekStart,
                WeekEnd = weekEnd
            })).ToList();

            static double DurationHours(TimeSpan start, TimeSpan end)
            {
                var diff = (end - start).TotalHours;
                if (diff < 0) diff += 24;
                return diff;
            }

            var newHours = DurationHours(shift.StartTime.Value, shift.EndTime.Value);
            var totalWeekHours = existing.Sum(x => DurationHours(x.StartTime, x.EndTime)) + newHours;
            if (!request.IsOvertime && totalWeekHours > 40.0 + 1e-9)
                return BadRequest(new { error = "Нарушение ТК РФ: превышение 40 часов работы в неделю" });

            // 12 часов отдыха между сменами: проверяем ближайшую предыдущую и следующую смену по дате.
            var prevNextSql = @"
                SELECT (shift_date::date)::timestamp as ShiftDate,
                       start_time as StartTime,
                       end_time as EndTime
                FROM shifts
                WHERE employee_id = @EmployeeId
                  AND shift_date::date BETWEEN @From AND @To
                  AND COALESCE(status, 'Confirmed') = 'Confirmed'
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
                var exDay = ex.ShiftDate;
                var exStart = exDay.Add(ex.StartTime);
                var exEnd = exDay.Add(ex.EndTime);
                if (ex.EndTime < ex.StartTime) exEnd = exEnd.AddDays(1);

                // если существующая смена заканчивается перед новой — проверяем отдых
                if (exEnd <= newStart)
                {
                    var rest = (newStart - exEnd).TotalHours;
                    if (!request.IsOvertime && rest < 12)
                        return BadRequest(new { error = "Нарушение ТК РФ: недостаточно времени для ежедневного отдыха (нужно ≥ 12 часов)" });
                }
                // если новая смена заканчивается перед существующей — проверяем отдых
                if (newEnd <= exStart)
                {
                    var rest = (exStart - newEnd).TotalHours;
                    if (!request.IsOvertime && rest < 12)
                        return BadRequest(new { error = "Нарушение ТК РФ: недостаточно времени для ежедневного отдыха (нужно ≥ 12 часов)" });
                }
            }

            var sql = @"
                INSERT INTO shifts (employee_id, work_area_id, shift_date, shift_type, start_time, end_time, status)
                VALUES (@EmployeeId, @WorkAreaId, @ShiftDate, @ShiftType, @StartTime, @EndTime, @Status)
                RETURNING id";

            try
            {
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
            catch (PostgresException ex) when (ex.SqlState == "23514")
            {
                return BadRequest(new { error = "Не удалось сохранить смену: ограничение БД по статусу/типу. Проверьте параметры смены." });
            }
        }

        // ИСПРАВЛЕНО: Теперь используем DTO класс StatusUpdateRequest для правильного чтения JSON {"status": "PendingSwap"}
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
    }

    // Вспомогательный класс для приема данных
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
        public DateTime ShiftDate { get; set; }
        public TimeSpan StartTime { get; set; }
        public TimeSpan EndTime { get; set; }
        public string ShiftType { get; set; } = "";
    }
}