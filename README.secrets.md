# Секреты и переменные окружения

Проект не хранит секреты в `appsettings.json`. Для запуска задайте переменные окружения.

## Обязательные переменные

### JWT
- `Jwt__Key` — длинный секрет (минимум 32 символа)
- `Jwt__Issuer` — например `NocControl` (если не задан, берется из `appsettings.json`)
- `Jwt__Audience` — например `NocControlUsers` (если не задан, берется из `appsettings.json`)

### Подключение к БД
- `ConnectionStrings__DefaultConnection` — строка подключения к PostgreSQL

Пример:

```powershell
$env:Jwt__Key="CHANGE_ME_TO_LONG_RANDOM_SECRET_32+"
$env:ConnectionStrings__DefaultConnection="Host=localhost;Port=5432;Database=noc_control_db;Username=postgres;Password=postgres"
```

После этого перезапустите backend.

