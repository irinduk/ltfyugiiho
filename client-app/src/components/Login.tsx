import React, { useState } from 'react';
import { ShieldCheck, Lock, User, AlertCircle, Loader2 } from 'lucide-react';

interface LoginProps {
    onLogin: (user: any) => void;
    theme: 'dark' | 'light';
}

export default function Login({ onLogin, theme }: LoginProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            // Безопасное чтение ответа сервера
            let data;
            const textResponse = await res.text();
            try {
                data = JSON.parse(textResponse);
            } catch (err) {
                // Если сервер выплюнул не JSON, а просто текст или HTML (Npgsql Exception)
                throw new Error(`Сервер БД недоступен или выдал ошибку: ${textResponse.substring(0, 80)}...`);
            }

            if (!res.ok) {
                throw new Error(data.message || data.error || 'Неверный email или пароль');
            }

            if (data.token) {
                localStorage.setItem('token', data.token);
            }

            const userData = data.user || data;
            onLogin(userData);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`min-h-screen flex items-center justify-center p-6 ${theme === 'dark' ? 'bg-[#0f172a]' : 'bg-slate-50'}`}>
            <div className={`w-full max-w-md p-8 rounded-3xl border shadow-2xl transition-all ${theme === 'dark' ? 'bg-[#1e293b] border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/20 mb-4">
                        <ShieldCheck className="text-white" size={32} />
                    </div>
                    <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>NOC Control</h1>
                    <p className={`text-sm mt-1 font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Авторизация в системе</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className={`block text-xs font-bold uppercase mb-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Email сотрудника</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={`w-full pl-10 pr-4 py-3 rounded-xl border outline-none transition-all focus:ring-2 focus:ring-blue-500/20 ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-600'}`}
                                placeholder="ivanov@noc.ru"
                            />
                        </div>
                    </div>

                    <div>
                        <label className={`block text-xs font-bold uppercase mb-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Пароль</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={`w-full pl-10 pr-4 py-3 rounded-xl border outline-none transition-all focus:ring-2 focus:ring-blue-500/20 ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-600'}`}
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center space-x-2 text-red-500 bg-red-500/10 p-3 rounded-xl border border-red-500/20 text-sm font-bold">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : <span>Войти</span>}
                    </button>
                </form>
            </div>
        </div>
    );
}