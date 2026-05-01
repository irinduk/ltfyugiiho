export type Role = 'Engineer' | 'Manager' | 'Admin';

export interface Employee {
    id: string;
    name: string;
    email: string;
    role: Role;
    clearances: string[];
    lastRestHours: number;
    requirePasswordChange?: boolean;
}

export interface Shift {
    id: string;
    employeeId: string;
    date: string;
    type: 'Day' | 'Night' | 'Custom';
    workAreaId: string;
    startTime?: string;
    endTime?: string;
    status: 'Confirmed' | 'PendingSwap';
}

export interface WorkArea {
    id: string;
    name: string;
    requiredClearances: string[];
    color: string;
}

// ИСПРАВЛЕНО: Поля приведены в соответствие с базой данных
export interface AuditLog {
    id: string;
    timestamp: string;
    userName: string;
    action: string;
    ipAddress: string;
}

export interface Notification {
    id: number;
    text: string;
    type: 'success' | 'info' | 'error';
}