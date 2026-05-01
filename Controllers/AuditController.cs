using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization; // Обязательно для RBAC
using Npgsql;
using Dapper;
using NOC_Management_App.Models;

namespace NOC_Management_App.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuditController : ControllerBase
    {
        private readonly string _connectionString;

        public AuditController(IConfiguration config)
        {
            _connectionString = config.GetConnectionString("DefaultConnection")!;
        }

        [HttpGet]
        [Authorize(Roles = "Admin")] // ИБ: Просматривать логи может только Админ
        public async Task<IActionResult> GetLogs()
        {
            using var conn = new NpgsqlConnection(_connectionString);
            // Используем псевдонимы (as), чтобы Dapper правильно собрал объект для React
            var sql = @"
                SELECT id as Id, 
                       timestamp as Timestamp, 
                       user_name as UserName, 
                       action as Action, 
                       ip_address as IpAddress 
                FROM audit_logs 
                ORDER BY timestamp DESC 
                LIMIT 100";
            var logs = await conn.QueryAsync<AuditLog>(sql);
            return Ok(logs);
        }

        [HttpPost]
        [Authorize] // ИБ: Писать логи могут все авторизованные сотрудники (невидимо для них)
        public async Task<IActionResult> AddLog([FromBody] AuditLog log)
        {
            using var conn = new NpgsqlConnection(_connectionString);
            var sql = "INSERT INTO audit_logs (user_name, action, ip_address) VALUES (@UserName, @Action, @IpAddress)";
            await conn.ExecuteAsync(sql, log);
            return Ok();
        }
    }
}