import { Employee, WorkArea, Shift } from './types';

export const EMPLOYEES: Employee[] = [];

export const WORK_AREAS: WorkArea[] = [
    { id: 'core', name: 'Ядро сети (Core)', requiredClearances: ['Cisco Core'], color: 'blue' },
    { id: 'edge', name: 'Периметр (Edge)', requiredClearances: ['Juniper Edge'], color: 'purple' },
    { id: 'linux', name: 'Серверная (Linux)', requiredClearances: ['Linux Admin'], color: 'emerald' },
    { id: 'security', name: 'Безопасность (SOC)', requiredClearances: ['Fortinet NSE'], color: 'red' },
    { id: 'monitoring', name: 'Мониторинг', requiredClearances: ['Zabbix Expert'], color: 'amber' },
];

export const INITIAL_SHIFTS: Shift[] = [];
