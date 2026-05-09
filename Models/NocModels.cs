using System.Text.Json.Serialization;

namespace NOC_Management_App.Models
{
    public class Employee
    {
        [JsonPropertyName("id")]
        public Guid Id { get; set; }

        [JsonPropertyName("name")]
        public string FullName { get; set; } = string.Empty;

        [JsonPropertyName("role")]
        public string Role { get; set; } = string.Empty;

        [JsonPropertyName("email")]
        public string Email { get; set; } = string.Empty;

        [JsonPropertyName("lastRestHours")]
        public int LastRestHours { get; set; }

        [JsonPropertyName("createdAt")]
        public DateTime CreatedAt { get; set; }

        [JsonPropertyName("clearances")]
        public string[] Clearances { get; set; } = Array.Empty<string>();

        [JsonPropertyName("gradeId")]
        public int? GradeId { get; set; }

        [JsonIgnore]
        public string? Password { get; set; }
    }

    public class Shift
    {
        [JsonPropertyName("id")]
        public Guid Id { get; set; }

        [JsonPropertyName("employeeId")]
        public Guid EmployeeId { get; set; }

        [JsonPropertyName("workAreaId")]
        public string WorkAreaId { get; set; } = string.Empty;

        [JsonPropertyName("shiftDate")]
        public DateTime ShiftDate { get; set; }

        [JsonPropertyName("shiftType")]
        public string ShiftType { get; set; } = string.Empty;

        [JsonPropertyName("startTime")]
        public TimeSpan? StartTime { get; set; }

        [JsonPropertyName("endTime")]
        public TimeSpan? EndTime { get; set; }

        [JsonPropertyName("status")]
        public string Status { get; set; } = "Confirmed";

        [JsonPropertyName("updatedAt")]
        public DateTime UpdatedAt { get; set; }
    }

    public class AuditLog
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }

        [JsonPropertyName("timestamp")]
        public DateTime Timestamp { get; set; }

        [JsonPropertyName("userName")]
        public string UserName { get; set; } = string.Empty;

        [JsonPropertyName("action")]
        public string Action { get; set; } = string.Empty;

        [JsonPropertyName("ipAddress")]
        public string IpAddress { get; set; } = string.Empty;
    }

    public class LoginRequest
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class ShiftListItemDto
    {
        [JsonPropertyName("id")]
        public Guid Id { get; set; }

        [JsonPropertyName("employeeId")]
        public Guid EmployeeId { get; set; }

        [JsonPropertyName("workAreaId")]
        public string WorkAreaId { get; set; } = string.Empty;

        [JsonPropertyName("shiftDate")]
        public string ShiftDate { get; set; } = string.Empty;

        [JsonPropertyName("shiftType")]
        public string ShiftType { get; set; } = string.Empty;

        [JsonPropertyName("startTime")]
        public string? StartTime { get; set; }

        [JsonPropertyName("endTime")]
        public string? EndTime { get; set; }

        [JsonPropertyName("status")]
        public string Status { get; set; } = "Confirmed";

        [JsonPropertyName("isOvertime")]
        public bool IsOvertime { get; set; }
    }
}
