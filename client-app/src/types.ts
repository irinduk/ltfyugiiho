export type Role = 'Engineer' | 'Manager' | 'Admin';

export interface Grade {
    id: number;
    name: string;
    level: number;
}

export interface Employee {
    id: string;
    name: string;
    email: string;
    role: Role;
    clearances: string[];
    lastRestHours: number;
    gradeId?: number;
    requirePasswordChange?: boolean;
    lastPasswordChange?: string;
    passwordChangeDueAt?: string;
}

export interface Shift {
    id: string;
    employeeId: string;
    date: string;
    type: 'Day' | 'Night' | 'Custom';
    workAreaId: string;
    startTime?: string;
    endTime?: string;
    status: 'Confirmed' | 'PendingSwap' | 'Overtime';
    isOvertime?: boolean;
}

export interface WorkArea {
    id: string;
    name: string;
    requiredClearances: string[];
    color: string;
}

// ����������: ���� ��������� � ������������ � ����� ������
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

export interface Vacation {
    id: number;
    employeeId: string;
    leaveType: 'Annual' | 'Maternity' | 'Sick' | 'Unpaid' | 'Study' | 'Other' | string;
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
    status: 'Pending' | 'Approved' | 'Rejected';
    createdAt?: string;
}