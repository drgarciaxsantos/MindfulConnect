
import { Appointment, AppointmentStatus, DayAvailability, TimeSlot, User, UserRole, SystemNotification } from '../types';
import { supabase } from './supabaseClient';

export const getCounselors = async (): Promise<User[]> => {
  const { data, error } = await supabase.from('counselors').select('*');
  if (error) return [];
  return (data || []).map((d: any) => ({
    id: String(d.id),
    name: d.name,
    role: UserRole.COUNSELOR,
    email: d.email
  }));
};

export const getAppointments = async (): Promise<Appointment[]> => {
  const { data, error } = await supabase.from('appointments').select('*');
  if (error) return [];
  return (data || []).map((d: any) => ({
    id: String(d.id),
    studentId: String(d.student_id),
    studentIdNumber: d.student_id_number,
    studentName: d.student_name,
    section: d.section,
    parentPhoneNumber: d.parent_phone_number,
    hasConsent: d.has_consent,
    counselorId: String(d.counselor_id),
    counselorName: d.counselor_name,
    date: d.date,
    time: d.time,
    reason: d.reason,
    description: d.description || '',
    status: d.status as AppointmentStatus,
    isAtGate: d.is_at_gate,
    createdAt: d.created_at,
    transferRequestToId: d.transfer_request_to_id ? String(d.transfer_request_to_id) : null,
    transferRequestToName: d.transfer_request_to_name,
    transferCounselorAccepted: d.transfer_counselor_accepted,
    transferStudentAccepted: d.transfer_student_accepted,
    rescheduleProposedDate: d.reschedule_proposed_date,
    rescheduleProposedTime: d.reschedule_proposed_time
  }));
};

export const requestGateVerification = async (appointmentId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('appointments')
    .update({ is_at_gate: true })
    .eq('id', appointmentId);
  return !error;
};

export const updateAppointmentStatus = async (id: string, status: AppointmentStatus): Promise<void> => {
  const { data: appt } = await supabase.from('appointments').select('*').eq('id', id).single();
  
  const updateData: any = { status };
  // If we are accepting or denying, student is no longer at the gate
  if (status === AppointmentStatus.ACCEPTED || status === AppointmentStatus.DENIED) {
    updateData.is_at_gate = false;
  }

  if (status === AppointmentStatus.CANCELLED && appt) {
     await updateSlotStatus(appt.counselor_id, appt.date, appt.time, false);
  }

  await supabase.from('appointments').update(updateData).eq('id', id);

  if (appt) {
    let msg = '';
    if (status === AppointmentStatus.CONFIRMED) msg = `Your appointment on ${appt.date} has been CONFIRMED.`;
    if (status === AppointmentStatus.CANCELLED) msg = `Your appointment on ${appt.date} was CANCELLED.`;
    if (status === AppointmentStatus.COMPLETED) msg = `Your session on ${appt.date} has been marked COMPLETED.`;
    if (status === AppointmentStatus.ACCEPTED) msg = `Gate Entry: Counselor has APPROVED your entry.`;
    if (status === AppointmentStatus.DENIED) msg = `Gate Entry: Counselor has DENIED your entry request.`;
    
    if (msg) await createNotification(appt.student_id, msg);
  }
};

export const createNotification = async (userId: string, message: string) => {
  await supabase.from('notifications').insert({ user_id: userId, message, is_read: false });
};

export const getSystemNotifications = async (userId: string): Promise<SystemNotification[]> => {
  const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) return [];
  return (data || []).map((n: any) => ({
    id: String(n.id),
    userId: String(n.user_id),
    message: n.message,
    isRead: n.is_read,
    createdAt: n.created_at
  }));
};

export const markNotificationRead = async (notificationId: string) => {
  await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
};

export const markAllNotificationsRead = async (userId: string) => {
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId);
};

export const checkAndSendReminders = async (userId: string) => {
  const { data: appointments } = await supabase.from('appointments').select('*').eq('status', 'CONFIRMED').or(`student_id.eq.${userId},counselor_id.eq.${userId}`);
  if (!appointments) return;
  const now = new Date();
  for (const appt of appointments) {
    const apptDateTime = new Date(`${appt.date}T${appt.time}`);
    const diffInHours = (apptDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (diffInHours > 0 && diffInHours <= 24) {
      const reminderMsg = `Reminder: You have an upcoming appointment on ${appt.date} at ${appt.time}.`;
      const { data: existing } = await supabase.from('notifications').select('id').eq('user_id', userId).eq('message', reminderMsg).limit(1);
      if (!existing || existing.length === 0) await createNotification(userId, reminderMsg);
    }
  }
};

export const saveAppointment = async (appointment: Appointment): Promise<Appointment | null> => {
  const dbPayload = {
    student_id: appointment.studentId,
    student_id_number: appointment.studentIdNumber,
    student_name: appointment.studentName,
    section: appointment.section,
    parent_phone_number: appointment.parentPhoneNumber,
    has_consent: appointment.hasConsent,
    counselor_id: appointment.counselorId,
    counselor_name: appointment.counselorName,
    date: appointment.date,
    time: appointment.time,
    reason: appointment.reason,
    description: appointment.description,
    status: appointment.status,
    created_at: appointment.createdAt
  };
  const { data, error } = await supabase.from('appointments').insert(dbPayload).select().single();
  if (error) return null;
  await updateSlotStatus(appointment.counselorId, appointment.date, appointment.time, true);
  await createNotification(appointment.counselorId, `New Request: ${appointment.studentName}`);
  return { ...appointment, id: String(data.id) };
};

export const respondToTransfer = async (appointmentId: string, accept: boolean, receivingCounselorId: string, receivingCounselorName: string): Promise<boolean> => {
  const { data: appt } = await supabase.from('appointments').select('*').eq('id', appointmentId).single();
  if (!appt) return false;
  if (accept) {
    await supabase.from('appointments').update({ transfer_counselor_accepted: true }).eq('id', appointmentId);
    if (appt.transfer_student_accepted) {
      await updateSlotStatus(appt.counselor_id, appt.date, appt.time, false);
      await updateSlotStatus(receivingCounselorId, appt.date, appt.time, true);
      await supabase.from('appointments').update({
        counselor_id: receivingCounselorId,
        counselor_name: receivingCounselorName,
        transfer_request_to_id: null,
        transfer_request_to_name: null,
        transfer_counselor_accepted: null,
        transfer_student_accepted: null,
        status: AppointmentStatus.CONFIRMED
      }).eq('id', appointmentId);
    }
    return true;
  }
  await supabase.from('appointments').update({ transfer_request_to_id: null, transfer_request_to_name: null }).eq('id', appointmentId);
  return true;
};

export const studentRespondToTransfer = async (appointmentId: string, accept: boolean): Promise<boolean> => {
  if (accept) {
    await supabase.from('appointments').update({ transfer_student_accepted: true }).eq('id', appointmentId);
    return true;
  }
  await supabase.from('appointments').update({ transfer_request_to_id: null, transfer_request_to_name: null }).eq('id', appointmentId);
  return true;
};

export const rescheduleAppointment = async (appointmentId: string, newDate: string, newTime: string): Promise<boolean> => {
  const { error } = await supabase.from('appointments').update({ reschedule_proposed_date: newDate, reschedule_proposed_time: newTime }).eq('id', appointmentId);
  return !error;
};

export const cancelRescheduleProposal = async (appointmentId: string): Promise<boolean> => {
  const { error } = await supabase.from('appointments').update({ reschedule_proposed_date: null, reschedule_proposed_time: null }).eq('id', appointmentId);
  return !error;
};

export const studentRespondToReschedule = async (appointmentId: string, accept: boolean): Promise<boolean> => {
  const { data: appt } = await supabase.from('appointments').select('*').eq('id', appointmentId).single();
  if (!appt) return false;
  if (accept) {
    await updateSlotStatus(appt.counselor_id, appt.date, appt.time, false);
    await updateSlotStatus(appt.counselor_id, appt.reschedule_proposed_date, appt.reschedule_proposed_time, true);
    await supabase.from('appointments').update({
      date: appt.reschedule_proposed_date,
      time: appt.reschedule_proposed_time,
      reschedule_proposed_date: null,
      reschedule_proposed_time: null,
      status: AppointmentStatus.CONFIRMED
    }).eq('id', appointmentId);
    return true;
  }
  await supabase.from('appointments').update({ status: AppointmentStatus.CANCELLED, reschedule_proposed_date: null }).eq('id', appointmentId);
  return true;
};

export const initiateTransfer = async (appointmentId: string, toCounselorId: string, toCounselorName: string): Promise<{ success: boolean; message: string }> => {
  await supabase.from('appointments').update({
    transfer_request_to_id: toCounselorId,
    transfer_request_to_name: toCounselorName,
    transfer_counselor_accepted: false,
    transfer_student_accepted: false
  }).eq('id', appointmentId);
  return { success: true, message: 'Transfer request sent.' };
};

export const cancelTransfer = async (appointmentId: string, originalCounselorName: string): Promise<boolean> => {
  const { error } = await supabase.from('appointments').update({
    transfer_request_to_id: null,
    transfer_request_to_name: null,
    transfer_counselor_accepted: null,
    transfer_student_accepted: null
  }).eq('id', appointmentId);
  return !error;
};

export const getCounselorAvailability = async (counselorId: string): Promise<DayAvailability[]> => {
  const { data, error } = await supabase.from('availability').select('*').eq('counselor_id', counselorId);
  if (error || !data) return [];
  return data.map((d: any) => ({ date: d.date, slots: d.slots || [] }));
};

export const saveAvailability = async (counselorId: string, date: string, timeSlots: string[]) => {
  const finalSlots: TimeSlot[] = timeSlots.map(time => ({ id: `${date}-${time}`, time, isBooked: false }));
  await supabase.from('availability').upsert({ counselor_id: counselorId, date, slots: finalSlots }, { onConflict: 'counselor_id,date' });
};

export const updateSlotStatus = async (counselorId: string, date: string, time: string, isBooked: boolean) => {
  const { data: existing } = await supabase.from('availability').select('slots').eq('counselor_id', counselorId).eq('date', date).maybeSingle();
  if (existing && existing.slots) {
    const updatedSlots = (existing.slots as TimeSlot[]).map(slot => slot.time === time ? { ...slot, isBooked } : slot);
    await supabase.from('availability').update({ slots: updatedSlots }).eq('counselor_id', counselorId).eq('date', date);
  }
};

export const subscribeToAppointments = (callback: () => void) => {
  const uniqueId = Math.random().toString(36).substring(7);
  const channel = supabase.channel(`public:appointments:${uniqueId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => callback()).subscribe();
  return () => { supabase.removeChannel(channel); };
};

export const initMockData = () => {};
