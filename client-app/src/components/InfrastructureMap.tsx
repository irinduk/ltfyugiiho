import React, { useState } from 'react';
// import { motion, AnimatePresence } from 'motion/react';
// ИСПРАВЛЕНО: Добавлен импорт Calendar
import { Network, Shield, Server, Lock, Activity, User, Info, AlertCircle, Calendar } from 'lucide-react';
import { Employee, Shift, WorkArea } from '../types';
import { WORK_AREAS } from '../constants';

interface InfrastructureMapProps {
    shifts: Shift[];
    employees: Employee[];
    theme: 'dark' | 'light';
}

interface Node {
    id: string;
    x: number;
    y: number;
    label: string;
    icon: React.ElementType;
    color: string;
    areaId: string;
}

const NODES: Node[] = [
    { id: '1', x: 400, y: 300, label: 'Core Network', icon: Network, color: '#3b82f6', areaId: 'core' },
    { id: '2', x: 200, y: 150, label: 'Edge Perimeter', icon: Shield, color: '#a855f7', areaId: 'edge' },
    { id: '3', x: 600, y: 150, label: 'System Admin', icon: Server, color: '#10b981', areaId: 'linux' },
    { id: '4', x: 200, y: 450, label: 'Security SOC', icon: Lock, color: '#ef4444', areaId: 'security' },
    { id: '5', x: 600, y: 450, label: 'Monitoring', icon: Activity, color: '#f59e0b', areaId: 'monitoring' },
];

const LINKS = [
    { source: '1', target: '2' },
    { source: '1', target: '3' },
    { source: '1', target: '4' },
    { source: '1', target: '5' },
    { source: '2', target: '4' },
    { source: '3', target: '5' },
];

export function InfrastructureMap({ shifts, employees, theme }: InfrastructureMapProps) {
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);

    // --- ИСПРАВЛЕНИЕ ДЛЯ КАРТЫ: Выбор даты ---
    const today = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(today);

    const getOnDuty = (areaId: string) => {
        return shifts.filter(s => s.workAreaId === areaId && s.date === selectedDate);
    };
    // ----------------------------------------

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Интерактивная карта инфраструктуры</h2>
                    <p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Визуализация связей и текущего распределения персонала</p>
                </div>

                {/* ИСПРАВЛЕНО: Интерактивный Date Picker вместо статического текста */}
                <div className={`px-4 py-2 rounded-xl border flex items-center space-x-3 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-sm'}`}>
                    <Calendar size={18} className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} />
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className={`text-sm font-bold tracking-wider outline-none bg-transparent cursor-pointer [color-scheme:${theme}]`}
                    />
                    {selectedDate === today && (
                        <div className="flex items-center space-x-1.5 ml-2 pl-3 border-l border-slate-200 dark:border-slate-700">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-green-500">Live</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className={`lg:col-span-2 relative rounded-3xl border overflow-hidden aspect-[4/3] lg:aspect-auto h-[500px] lg:h-[600px] ${theme === 'dark' ? 'bg-[#0f172a] border-slate-800 shadow-2xl' : 'bg-slate-50 border-slate-200 shadow-inner'}`}>
                    <svg className="w-full h-full" viewBox="0 0 800 600">
                        {/* Connection Lines */}
                        {LINKS.map((link, i) => {
                            const source = NODES.find(n => n.id === link.source)!;
                            const target = NODES.find(n => n.id === link.target)!;
                            return (
                                <line
                                    key={`link-${i}`}
                                    x1={source.x}
                                    y1={source.y}
                                    x2={target.x}
                                    y2={target.y}
                                    stroke={theme === 'dark' ? '#1e293b' : '#cbd5e1'}
                                    strokeWidth="2"
                                />
                            );
                        })}

                        {/* Nodes */}
                        {NODES.map((node) => {
                            const onDutyCount = getOnDuty(node.areaId).length;
                            const isSelected = selectedNode?.id === node.id;

                            return (
                                <g
                                    key={node.id}
                                    className="cursor-pointer"
                                    onClick={() => setSelectedNode(node)}
                                >
                                    {/* Outer Glow */}
                                    <circle
                                        cx={node.x}
                                        cy={node.y}
                                        r={isSelected ? 45 : 35}
                                        fill={node.color}
                                        opacity={isSelected ? 0.3 : 0.1}
                                    />

                                    {/* Pulse Effect for nodes with people */}
                                    {onDutyCount > 0 && (
                                        <circle
                                            cx={node.x}
                                            cy={node.y}
                                            r={35}
                                            stroke={node.color}
                                            strokeWidth="1"
                                            fill="none"
                                        />
                                    )}

                                    {/* Main Node Circle */}
                                    <circle
                                        cx={node.x}
                                        cy={node.y}
                                        r={30}
                                        fill={theme === 'dark' ? '#1e293b' : '#ffffff'}
                                        stroke={isSelected ? node.color : (theme === 'dark' ? '#334155' : '#e2e8f0')}
                                        strokeWidth="2"
                                    />

                                    {/* Icon */}
                                    <foreignObject x={node.x - 12} y={node.y - 12} width="24" height="24" className="pointer-events-none">
                                        <div className="flex items-center justify-center h-full w-full" style={{ color: node.color }}>
                                            <node.icon size={20} />
                                        </div>
                                    </foreignObject>

                                    {/* Label */}
                                    <text
                                        x={node.x}
                                        y={node.y + 45}
                                        textAnchor="middle"
                                        className={`text-[10px] font-bold uppercase tracking-widest pointer-events-none ${theme === 'dark' ? 'fill-slate-400' : 'fill-slate-900'}`}
                                    >
                                        {node.label}
                                    </text>

                                    {/* Badge */}
                                    {onDutyCount > 0 && (
                                        <g transform={`translate(${node.x + 15}, ${node.y - 25})`}>
                                            <circle r="8" fill={node.color} />
                                            <text
                                                textAnchor="middle"
                                                dy=".3em"
                                                fill="white"
                                                fontSize="8"
                                                fontWeight="bold"
                                                className="pointer-events-none"
                                            >
                                                {onDutyCount}
                                            </text>
                                        </g>
                                    )}
                                </g>
                            );
                        })}
                    </svg>

                    {/* Legend */}
                    <div className="absolute bottom-6 left-6 flex flex-col space-y-2">
                        <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>Network Activity</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded-full border border-slate-500 opacity-50"></div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>Inert Logical Link</span>
                        </div>
                    </div>
                </div>

                {/* Info Panel */}
                <div className="space-y-6">
                    <div>
                        {!selectedNode ? (
                            <div
                                className={`p-8 rounded-3xl border flex flex-col items-center justify-center text-center space-y-4 h-full min-h-[400px] ${theme === 'dark' ? 'bg-[#1e293b] border-slate-800' : 'bg-white border-slate-200'}`}
                            >
                                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400">
                                    <Info size={32} />
                                </div>
                                <div>
                                    <h4 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Выберите узел</h4>
                                    <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Нажмите на любой объект на карте, чтобы увидеть детализацию смен и состояние персонала.</p>
                                </div>
                            </div>
                        ) : (
                            <div
                                className={`rounded-3xl border overflow-hidden flex flex-col h-full min-h-[400px] ${theme === 'dark' ? 'bg-[#1e293b] border-slate-800' : 'bg-white border-slate-200 shadow-xl'}`}
                            >
                                <div className="p-6 border-b dark:border-slate-800" style={{ backgroundColor: `${selectedNode.color}10` }}>
                                    <div className="flex items-center space-x-3 mb-2">
                                        <div className="p-2 rounded-lg bg-white dark:bg-slate-900 shadow-sm" style={{ color: selectedNode.color }}>
                                            <selectedNode.icon size={20} />
                                        </div>
                                        <div>
                                            <h4 className={`font-bold transition-colors ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{selectedNode.label}</h4>
                                            <p className="text-[10px] uppercase font-bold tracking-widest mb-1" style={{ color: selectedNode.color }}>Active Area: {selectedNode.areaId}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 flex-1 space-y-6">
                                    <div>
                                        <h5 className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>Персонал на дежурстве</h5>
                                        <div className="space-y-3">
                                            {getOnDuty(selectedNode.areaId).length === 0 ? (
                                                <div className={`p-4 rounded-2xl border border-dashed flex items-center space-x-3 ${theme === 'dark' ? 'bg-slate-900/50 border-slate-700 text-slate-500' : 'bg-slate-50 border-slate-300 text-red-600'}`}>
                                                    <AlertCircle size={18} />
                                                    <span className="text-sm font-medium">Нет назначенных сотрудников</span>
                                                </div>
                                            ) : (
                                                getOnDuty(selectedNode.areaId).map(s => {
                                                    const emp = employees.find(e => String(e.id).toLowerCase() === String(s.employeeId).toLowerCase());
                                                    return (
                                                        <div key={s.id} className={`p-4 rounded-2xl border transition-all ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <div className="flex items-center space-x-2">
                                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-slate-900 text-white'}`}>
                                                                        {emp?.name.split(' ').map(n => n[0]).join('')}
                                                                    </div>
                                                                    <span className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{emp?.name}</span>
                                                                </div>
                                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${s.type === 'Day' ? 'bg-amber-500/10 text-amber-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
                                                                    {s.type === 'Day' ? '☀️' : '🌙'}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1">
                                                                {emp?.clearances.slice(0, 2).map(c => (
                                                                    <span key={c} className={`text-[8px] px-1.5 py-0.5 rounded border uppercase font-bold ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                                                        {c}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>

                                    <div className={`p-4 rounded-2xl border ${theme === 'dark' ? 'bg-blue-600/5 border-blue-500/10' : 'bg-blue-50 border-blue-100'}`}>
                                        <h5 className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-700'}`}>Требования к допуску</h5>
                                        <p className={`text-xs font-medium leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-900'}`}>
                                            Для работы в этой зоне требуется подтвержденный уровень компетенций: {WORK_AREAS.find(a => a.id === selectedNode.areaId)?.requiredClearances.join(', ')}.
                                        </p>
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-100 dark:bg-slate-800/50">
                                    <button
                                        onClick={() => setSelectedNode(null)}
                                        className="w-full py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold transition-all hover:bg-slate-50 active:scale-[0.98] text-slate-900 dark:text-white"
                                    >
                                        Закрыть панель
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}