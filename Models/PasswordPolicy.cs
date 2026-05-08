using System.Text.RegularExpressions;

namespace NOC_Management_App.Models
{
    public static class PasswordPolicy
    {
        private static readonly Regex UppercaseRegex = new(@"[A-Z]", RegexOptions.Compiled);
        private static readonly Regex LowercaseRegex = new(@"[a-z]", RegexOptions.Compiled);
        private static readonly Regex DigitRegex = new(@"\d", RegexOptions.Compiled);
        private static readonly Regex SpecialRegex = new(@"[^A-Za-z0-9]", RegexOptions.Compiled);

        public static bool TryValidate(string? password, out string error)
        {
            if (string.IsNullOrWhiteSpace(password))
            {
                error = "Пароль обязателен";
                return false;
            }

            if (password.Length < 8)
            {
                error = "Пароль должен быть не менее 8 символов";
                return false;
            }

            if (password.Any(char.IsWhiteSpace))
            {
                error = "Пароль не должен содержать пробелы";
                return false;
            }

            if (!UppercaseRegex.IsMatch(password))
            {
                error = "Пароль должен содержать хотя бы одну заглавную латинскую букву";
                return false;
            }

            if (!LowercaseRegex.IsMatch(password))
            {
                error = "Пароль должен содержать хотя бы одну строчную латинскую букву";
                return false;
            }

            if (!DigitRegex.IsMatch(password))
            {
                error = "Пароль должен содержать хотя бы одну цифру";
                return false;
            }

            if (!SpecialRegex.IsMatch(password))
            {
                error = "Пароль должен содержать хотя бы один спецсимвол";
                return false;
            }

            error = string.Empty;
            return true;
        }
    }
}
