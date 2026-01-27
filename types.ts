
export enum UserRole {
  STUDENT = 'STUDENT',
  COUNSELOR = 'COUNSELOR'
}

export enum AppointmentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED'
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
  // Student specific fields
  studentIdNumber?: string;
  section?: string;
  parentPhoneNumber?: string;
}

export interface TimeSlot {
  id: string;
  time: string; // HH:mm format
  isBooked: boolean;
}

export interface DayAvailability {
  date: string; // YYYY-MM-DD
  slots: TimeSlot[];
}

export interface CounselorAvailability {
  counselorId: string;
  availability: DayAvailability[];
}

export interface Appointment {
  id: string;
  studentId: string; // System ID
  studentIdNumber: string; // School ID Number
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
