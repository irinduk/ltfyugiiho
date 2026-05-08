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
        public async Task<IActionResult> GetLogs([FromQuery] Guid? employeeId = null)
        {
            using var conn = new NpgsqlConnection(_connectionString);

            string? employeeEmail = null;
            if (employeeId.HasValue && employeeId.Value != Guid.Empty)
            {
                employeeEmail = await conn.ExecuteScalarAsync<string?>("SELECT email FROM employees WHERE id = @Id", new { Id = employeeId.Value });
                if (string.IsNullOrWhiteSpace(employeeEmail))
                    return Ok(Array.Empty<AuditLog>());
            }

            // Используем псевдонимы (as), чтобы Dapper правильно собрал объект для React
            var sql = @"
                SELECT id as Id, 
                       timestamp as Timestamp, 
                       user_name as UserName, 
                       action as Action, 
                       ip_address as IpAddress 
                FROM audit_logs 
                WHERE (@UserName IS NULL OR user_name = @UserName)
                ORDER BY timestamp DESC 
                LIMIT 200";
            var logs = await conn.QueryAsync<AuditLog>(sql, new { UserName = employeeEmail });
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

        [HttpGet("metrics")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetSecurityMetrics()
        {
            using var conn = new NpgsqlConnection(_connectionString);

            var activeSessions = await conn.ExecuteScalarAsync<int>(@"
                SELECT COUNT(DISTINCT user_name)
                FROM audit_logs
                WHERE timestamp >= NOW() - INTERVAL '24 hours'
                  AND user_name IS NOT NULL
                  AND user_name <> ''");

            var intrusionAttempts = await conn.ExecuteScalarAsync<int>(@"
                SELECT COUNT(*)
                FROM audit_logs
                WHERE timestamp >= NOW() - INTERVAL '30 days'
                  AND (
                        LOWER(action) LIKE '%неверн%'
                     OR LOWER(action) LIKE '%ошибк%'
                     OR LOWER(action) LIKE '%unauthor%'
                     OR LOWER(action) LIKE '%forbidden%'
                     OR LOWER(action) LIKE '%denied%'
                     OR LOWER(action) LIKE '%взлом%'
                  )");

            var integrity = await conn.QueryFirstAsync<(int Total, int Valid)>(@"
                SELECT
                    COUNT(*)::int as Total,
                    COUNT(*) FILTER (
                        WHERE user_name IS NOT NULL AND user_name <> ''
                          AND action IS NOT NULL AND action <> ''
                          AND ip_address IS NOT NULL AND ip_address <> ''
                    )::int as Valid
                FROM audit_logs
                WHERE timestamp >= NOW() - INTERVAL '30 days'");

            var integrityPercent = integrity.Total == 0
                ? 100
                : (int)Math.Round((double)integrity.Valid * 100 / integrity.Total);

            return Ok(new
            {
                activeSessions,
                intrusionAttempts,
                logIntegrityPercent = integrityPercent
            });
        }
    }
}