import React from 'react';
import { Settings } from 'lucide-react';
import { Role } from '../types';

interface SettingsViewProps {
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  role: Role;
  passwordChangeDueAt?: string;
  onChangePassword: (oldPassword: string, newPassword: string) => Promise<{ ok: boolean; message: string }>;
}

export function SettingsView({ 
  theme, 
  setTheme, 
  role,
  passwordChangeDueAt,
  onChangePassword
}: SettingsViewProps) {
  const [oldPassword, setOldPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [repeatPassword, setRepeatPassword] = React.useState('');
  const [passwordMsg, setPasswordMsg] = React.useState<string | null>(null);
  const [isSavingPassword, setIsSavingPassword] = React.useState(false);

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) return 'Новый пароль должен быть не менее 8 символов';
    if (/\s/.test(password)) return 'Пароль не должен содержать пробелы';
    if (!/[A-Z]/.test(password)) return 'Добавьте хотя бы одну заглавную латинскую букву (A-Z)';
    if (!/[a-z]/.test(password)) return 'Добавьте хотя бы одну строчную латинскую букву (a-z)';
    if (!/\d/.test(password)) return 'Добавьте хотя бы одну цифру';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Добавьте хотя бы один спецсимвол';
    return null;
  };

  const dueDateLabel = passwordChangeDueAt
    ? new Date(passwordChangeDueAt).toLocaleDateString('ru-RU')
    : 'Не указано';

  const handleChangePassword = async () => {
    setPasswordMsg(null);

    if (!oldPassword || !newPassword || !repeatPassword) {
      setPasswordMsg('Заполните все поля для смены пароля');
      return;
    }

    if (newPassword !== repeatPassword) {
      setPasswordMsg('Новый пароль и подтверждение не совпадают');
      return;
    }

    const validationError = validatePassword(newPassword);
    if (validationError) {
      setPasswordMsg(validationError);
      return;
    }

    setIsSavingPassword(true);
    const result = await onChangePassword(oldPassword, newPassword);
    setPasswordMsg(result.message);

    if (result.ok) {
      setOldPassword('');
      setNewPassword('');
      setRepeatPassword('');
    }
    setIsSavingPassword(false);
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-blue-950'}`}>Настройки системы</h2>
        <p className="text-slate-600 dark:text-slate-400 mt-1 font-medium">Персонализация интерфейса и параметров планирования</p>
      </div>

      <div className={`p-6 rounded-2xl border transition-colors shadow-sm dark:shadow-xl ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
        <h3 className={`text-lg font-bold mb-6 flex items-center space-x-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
          <Settings size={20} className="text-blue-500" />
          <span>Внешний вид</span>
        </h3>
        
        <div className="flex items-center justify-between">
          <div>
            <p className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>Тема оформления</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Переключение между светлым и темным режимом</p>
          </div>
          <div className={`flex p-1 rounded-xl border ${theme === 'dark' ? 'bg-slate-900 border-transparent' : 'bg-slate-100 border-slate-200'}`}>
            <button 
              onClick={() => setTheme('light')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-2 ${theme === 'light' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              ☀️ <span>Светлая</span>
            </button>
            <button 
              onClick={() => setTheme('dark')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-2 ${theme === 'dark' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-blue-400'}`}
            >
              🌙 <span>Темная</span>
            </button>
          </div>
        </div>
      </div>

      <div className={`p-6 rounded-2xl border transition-colors shadow-sm dark:shadow-xl ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
        <h3 className={`text-lg font-bold mb-6 flex items-center space-x-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
          <Settings size={20} className="text-blue-500" />
          <span>Безопасность профиля</span>
        </h3>
        <div className="space-y-4">
          <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-blue-500/5 border-blue-500/20' : 'bg-white border-slate-200 shadow-sm'}`}>
            <p className={`text-sm font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>
              Следующая обязательная смена пароля: {dueDateLabel}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Политика безопасности: смена пароля каждые 90 дней.
            </p>
          </div>

          <div>
            <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>Текущий пароль</label>
            <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)}
              className={`w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500 transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
          </div>
          <div>
            <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>Новый пароль</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              className={`w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500 transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Минимум 8 символов, без пробелов, минимум 1 заглавная и 1 строчная латинская буква, 1 цифра и 1 спецсимвол.
            </p>
          </div>
          <div>
            <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>Подтверждение пароля</label>
            <input type="password" value={repeatPassword} onChange={(e) => setRepeatPassword(e.target.value)}
              className={`w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500 transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
          </div>

          {passwordMsg && (
            <div className={`text-sm font-medium ${passwordMsg.toLowerCase().includes('успеш') ? 'text-green-500' : 'text-red-500'}`}>
              {passwordMsg}
            </div>
          )}

          <button
            onClick={handleChangePassword}
            disabled={isSavingPassword}
            className="w-full py-2 bg-blue-600 rounded-lg font-bold text-white hover:bg-blue-500 transition-colors disabled:opacity-60"
          >
            {isSavingPassword ? 'Сохранение...' : 'Сменить пароль'}
          </button>
        </div>
      </div>

    </div>
  );
}
