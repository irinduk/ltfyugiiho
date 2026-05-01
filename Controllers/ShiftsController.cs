using Microsoft.AspNetCore.Mvc;
using Npgsql;
using Dapper;
using NOC_Management_App.Models;

namespace NOC_Management_App.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
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
            using var conn = new NpgsqlConnection(_connectionString);
            var sql = "SELECT id, employee_id as EmployeeId, work_area_id as WorkAreaId, shift_date as ShiftDate, shift_type as ShiftType, start_time as StartTime, end_time as EndTime, status FROM shifts";
            var shifts = await conn.QueryAsync<Shift>(sql);
            return Ok(shifts);
        }

        [HttpPost]
        public async Task<IActionResult> AssignShift([FromBody] Shift shift)
        {
            using var conn = new NpgsqlConnection(_connectionString);
            var sql = @"
                INSERT INTO shifts (employee_id, work_area_id, shift_date, shift_type, start_time, end_time, status)
                VALUES (@EmployeeId, @WorkAreaId, @ShiftDate, @ShiftType, @StartTime, @EndTime, @Status)
                RETURNING id";

            var id = await conn.ExecuteScalarAsync<Guid>(sql, shift);
            shift.Id = id;
            return Ok(shift);
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
    }

    // Вспомогательный класс для приема данных
    public class StatusUpdateRequest
    {
        public string? Status { get; set; }
    }
}