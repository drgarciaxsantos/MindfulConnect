
export enum UserRole {
  STUDENT = 'STUDENT',
  COUNSELOR = 'COUNSELOR'
}

export enum AppointmentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
  ACCEPTED = 'ACCEPTED',
  DENIED = 'DENIED'
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
  studentIdNumber?: string;
  section?: string;
  parentPhoneNumber?: string;
}

export interface TimeSlot {
  id: string;
  time: string;
  isBooked: boolean;
}

export interface DayAvailability {
  date: string;
  slots: TimeSlot[];
}

export interface Appointment {
  id: string;
  studentId: string;
  studentIdNumber: string;
  studentName: string;
  section: string;
  parentPhoneNumber: string;
  hasConsent: boolean;
  
  counselorId: string;
  counselorName: string;
  date: string;
  time: string;
  reason: string;
  description: string;
  status: AppointmentStatus;
  createdAt: string;

  // Gate Control
  isAtGate?: boolean;

  // Transfer fields
  transferRequestToId?: string | null;
  transferRequestToName?: string | null;
  transferCounselorAccepted?: boolean;
  transferStudentAccepted?: boolean;

  // Reschedule fields
  rescheduleProposedDate?: string | null;
  rescheduleProposedTime?: string | null;
}

export interface SystemNotification {
  id: string;
  userId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}
