
import { Appointment, AppointmentStatus, DayAvailability, TimeSlot, User, UserRole, SystemNotification } from '../types';
import { supabase } from './supabaseClient';

const MIN_INTERVAL_MINUTES = 80;

const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const hasIntervalConflict = (newTime: string, existingTimes: string[]): boolean => {
  const newMinutes = timeToMinutes(newTime);
  return existingTimes.some(existingTime => {
    const existingMinutes = timeToMinutes(existingTime);
    return Math.abs(newMinutes - existingMinutes) < MIN_INTERVAL_MINUTES;
  });
};

export const getCounselors = async (): Promise<User[]> => {
  const { data, error } = await supabase
    .from('counselors')
    .select('*');

  if (error) {
    console.error('Error fetching counselors:', error.message);
    return [];
  }

  return (data || []).map((d: any) => ({
    id: String(d.id),
    name: d.name,
    role: UserRole.COUNSELOR,
    email: d.email
  }));
};

export const getAppointments = async (): Promise<Appointment[]> => {
  const { data, error } = await supabase
    .from('appointments')
    .select('*');
  
  if (error) {
    console.error('Error fetching appointments:', error.message);
    return [];
  }
  
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
    status: d.status,
    createdAt: d.created_at,
    transferRequestToId: d.transfer_request_to_id ? String(d.transfer_request_to_id) : null,
    transferRequestToName: d.transfer_request_to_name,
    transferCounselorAccepted: d.transfer_counselor_accepted,
    transferStudentAccepted: d.transfer_student_accepted,
    rescheduleProposedDate: d.reschedule_proposed_date,
    rescheduleProposedTime: d.reschedule_proposed_time
  }));
};

// --- NOTIFICATION SYSTEM ---

export const createNotification = async (userId: string, message: string) => {
  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      message: message,
      is_read: false
    });
    
  if (error) console.error("Failed to create notification:", error.message);
};

export const getSystemNotifications = async (userId: string): Promise<SystemNotification[]> => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

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
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
};

export const markAllNotificationsRead = async (userId: string) => {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId);
};

export const checkAndSendReminders = async (userId: string) => {
  const { data: appointments } = await supabase
    .from('appointments')
    .select('*')
    .eq('status', 'CONFIRMED')
    .or(`student_id.eq.${userId},counselor_id.eq.${userId}`);

  if (!appointments) return;

  const now = new Date();

  for (const appt of appointments) {
    const apptDateTime = new Date(`${appt.date}T${appt.time}`);
    const diffInMs = apptDateTime.getTime() - now.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);

    if (diffInHours > 0 && diffInHours <= 24) {
      const reminderMsg = `Reminder: You have an upcoming appointment on ${appt.date} at ${appt.time}.`;
      
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('message', reminderMsg)
        .limit(1);

      if (!existing || existing.length === 0) {
        await createNotification(userId, reminderMsg);
      }
    }
  }
};

// --- END NOTIFICATION SYSTEM ---

export const saveAppointment = async (appointment: Appointment): Promise<Appointment | null> => {
  // FINAL SAFETY CHECK: Check if the student already has an appointment at this time
  const { data: studentConflicts } = await supabase
    .from('appointments')
    .select('id')
    .eq('student_id', appointment.studentId)
    .eq('date', appointment.date)
    .eq('time', appointment.time)
    .in('status', [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]);

  if (studentConflicts && studentConflicts.length > 0) {
    console.error('Student double booking detected');
    return null;
  }

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

  const { data, error } = await supabase
    .from('appointments')
    .insert(dbPayload)
    .select()
    .single();

  if (error) {
    console.error('Error saving appointment:', error.message);
    return null;
  }

  await updateSlotStatus(appointment.counselorId, appointment.date, appointment.time, true);

  await createNotification(
    appointment.counselorId,
    `New Appointment Request: ${appointment.studentName} for ${appointment.date} at ${appointment.time}`
  );

  return {
    id: String(data.id),
    studentId: String(data.student_id),
    studentIdNumber: data.student_id_number,
    studentName: data.student_name,
    section: data.section,
    parentPhoneNumber: data.parent_phone_number,
    hasConsent: data.has_consent,
    counselorId: String(data.counselor_id),
    counselorName: data.counselor_name,
    date: data.date,
    time: data.time,
    reason: data.reason,
    description: data.description,
    status: data.status,
    createdAt: data.created_at
  };
};

export const updateAppointmentStatus = async (id: string, status: AppointmentStatus): Promise<void> => {
  const { data: appt } = await supabase.from('appointments').select('*').eq('id', id).single();
  
  if (status === AppointmentStatus.CANCELLED && appt) {
     await updateSlotStatus(appt.counselor_id, appt.date, appt.time, false);
  }

  const { error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', id);
    
  if (error) console.error('Error updating status:', error.message);

  if (appt) {
    let msg = '';
    if (status === AppointmentStatus.CONFIRMED) msg = `Your appointment on ${appt.date} has been CONFIRMED by Counselor ${appt.counselor_name}.`;
    if (status === AppointmentStatus.CANCELLED) msg = `Your appointment on ${appt.date} was CANCELLED.`;
    if (status === AppointmentStatus.COMPLETED) msg = `Your session on ${appt.date} has been marked COMPLETED.`;
    
    if (msg) {
      await createNotification(appt.student_id, msg);
    }
  }
};

const finalizeTransfer = async (appt: any) => {
  const receivingCounselorId = appt.transfer_request_to_id;
  const receivingCounselorName = appt.transfer_request_to_name;

  await updateSlotStatus(appt.counsel_id, appt.date, appt.time, false);
  await updateSlotStatus(receivingCounselorId, appt.date, appt.time, true);

  const { error } = await supabase
    .from('appointments')
    .update({
      counselor_id: receivingCounselorId,
      counselor_name: receivingCounselorName,
      transfer_request_to_id: null,
      transfer_request_to_name: null,
      transfer_counselor_accepted: null,
      transfer_student_accepted: null,
      status: AppointmentStatus.CONFIRMED
    })
    .eq('id', appt.id);

  if (!error) {
    await createNotification(appt.student_id, `Transfer finalized! Your appointment is now with Counselor ${receivingCounselorName}.`);
    await createNotification(appt.counselor_id, `Your transfer for ${appt.student_name} is complete.`);
    await createNotification(receivingCounselorId, `The transfer for ${appt.student_name} has been finalized.`);
  }
};

export const respondToTransfer = async (appointmentId: string, accept: boolean, receivingCounselorId: string, receivingCounselorName: string): Promise<boolean> => {
  const { data: appt } = await supabase.from('appointments').select('*').eq('id', appointmentId).single();
  if (!appt) return false;

  if (accept) {
    const { error } = await supabase
      .from('appointments')
      .update({ transfer_counselor_accepted: true })
      .eq('id', appointmentId);

    if (error) {
      console.error('Error in respondToTransfer:', error.message);
      return false;
    }

    if (appt.transfer_student_accepted) {
      await finalizeTransfer(appt);
    } else {
      await createNotification(appt.student_id, `Counselor ${receivingCounselorName} has agreed to take your appointment. Please approve the transfer in your dashboard.`);
    }
    return true;

  } else {
    const { error } = await supabase
      .from('appointments')
      .update({
        transfer_request_to_id: null,
        transfer_request_to_name: null,
        transfer_counselor_accepted: null,
        transfer_student_accepted: null
      })
      .eq('id', appointmentId);

    if (error) return false;
    await createNotification(appt.counselor_id, `Your transfer request for ${appt.student_name} was DECLINED.`);
    return true;
  }
};

export const studentRespondToTransfer = async (appointmentId: string, accept: boolean): Promise<boolean> => {
  const { data: appt } = await supabase.from('appointments').select('*').eq('id', appointmentId).single();
  if (!appt) return false;

  if (accept) {
    const { error } = await supabase
      .from('appointments')
      .update({ transfer_student_accepted: true })
      .eq('id', appointmentId);

    if (error) return false;

    if (appt.transfer_counselor_accepted) {
      await finalizeTransfer(appt);
    }
    return true;
  } else {
    const { error } = await supabase
      .from('appointments')
      .update({
        transfer_request_to_id: null,
        transfer_request_to_name: null,
        transfer_counselor_accepted: null,
        transfer_student_accepted: null
      })
      .eq('id', appointmentId);

    if (!error) {
      await createNotification(appt.counselor_id, `Student ${appt.student_name} declined the transfer request.`);
    }
    return !error;
  }
};

export const rescheduleAppointment = async (appointmentId: string, newDate: string, newTime: string): Promise<boolean> => {
  try {
    const { data: appt, error: fetchError } = await supabase
      .from('appointments')
      .select('student_id, counselor_name')
      .eq('id', appointmentId)
      .single();
    
    if (fetchError || !appt) {
      console.error('Fetch error during reschedule:', fetchError?.message || 'Appointment not found');
      return false;
    }

    const { error: updateError } = await supabase
      .from('appointments')
      .update({ 
        reschedule_proposed_date: newDate, 
        reschedule_proposed_time: newTime
      })
      .eq('id', appointmentId);

    if (updateError) {
      console.error('Update error during reschedule:', updateError.message);
      return false;
    }

    await createNotification(appt.student_id, `Counselor ${appt.counselor_name} has proposed to reschedule your appointment to ${newDate} at ${newTime}. Please review and approve.`);
    return true;
  } catch (err) {
    console.error('Unexpected error in rescheduleAppointment:', err);
    return false;
  }
};

export const cancelRescheduleProposal = async (appointmentId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('appointments')
    .update({
      reschedule_proposed_date: null,
      reschedule_proposed_time: null
    })
    .eq('id', appointmentId);
    
  if (error) console.error('Error cancelling proposal:', error.message);
  return !error;
};

export const studentRespondToReschedule = async (appointmentId: string, accept: boolean): Promise<boolean> => {
  try {
    const { data: appt, error: fetchError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();
      
    if (fetchError || !appt || !appt.reschedule_proposed_date || !appt.reschedule_proposed_time) {
      console.error('Fetch error or missing proposal in response:', fetchError?.message);
      return false;
    }

    if (accept) {
      // 1. Mark original slot as free
      await updateSlotStatus(appt.counselor_id, appt.date, appt.time, false);
      // 2. Mark new slot as booked
      await updateSlotStatus(appt.counselor_id, appt.reschedule_proposed_date, appt.reschedule_proposed_time, true);
      
      const { error } = await supabase
        .from('appointments')
        .update({
          date: appt.reschedule_proposed_date,
          time: appt.reschedule_proposed_time,
          reschedule_proposed_date: null,
          reschedule_proposed_time: null,
          status: AppointmentStatus.CONFIRMED
        })
        .eq('id', appointmentId);
        
      if (!error) {
        await createNotification(appt.counselor_id, `Student ${appt.student_name} has approved the reschedule for ${appt.reschedule_proposed_date}.`);
      }
      return !error;
    } else {
      // DECLINE CASE: Automatically cancel the appointment
      
      // 1. Release the original slot (it was reserved)
      await updateSlotStatus(appt.counselor_id, appt.date, appt.time, false);
      
      const { error } = await supabase
        .from('appointments')
        .update({
          status: AppointmentStatus.CANCELLED,
          reschedule_proposed_date: null,
          reschedule_proposed_time: null
        })
        .eq('id', appointmentId);
        
      if (!error) {
        await createNotification(appt.counselor_id, `Student ${appt.student_name} has declined the reschedule proposal. The appointment has been automatically CANCELLED.`);
      }
      return !error;
    }
  } catch (err) {
    console.error('Unexpected error in studentRespondToReschedule:', err);
    return false;
  }
};

export const initiateTransfer = async (appointmentId: string, toCounselorId: string, toCounselorName: string): Promise<{ success: boolean; message: string }> => {
  const { data: appt, error: fetchError } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', appointmentId)
    .single();

  if (fetchError || !appt) {
    return { success: false, message: 'Appointment details not found.' };
  }

  const { data: conflicts } = await supabase
    .from('appointments')
    .select('time')
    .eq('counselor_id', toCounselorId)
    .eq('date', appt.date)
    .eq('status', AppointmentStatus.CONFIRMED);

  if (conflicts && hasIntervalConflict(appt.time, conflicts.map(c => c.time))) {
    return { 
      success: false, 
      message: `${toCounselorName} has an appointment too close to this time (Mandatory 80-minute buffer). Transfer denied.` 
    };
  }

  const { error } = await supabase
    .from('appointments')
    .update({
      transfer_request_to_id: toCounselorId,
      transfer_request_to_name: toCounselorName,
      transfer_counselor_accepted: false,
      transfer_student_accepted: false
    })
    .eq('id', appointmentId);

  if (error) {
    console.error('Error in initiateTransfer:', error.message);
    return { success: false, message: 'Database error occurred during transfer.' };
  }

  await createNotification(toCounselorId, `Incoming transfer request for appointment #${appointmentId.slice(0,4)}`);
  await createNotification(appt.student_id, `Counselor ${appt.counselor_name} is requesting to transfer your session to ${toCounselorName}. Please review.`);

  return { success: true, message: 'Transfer request sent successfully.' };
};

export const cancelTransfer = async (appointmentId: string, originalCounselorName: string): Promise<boolean> => {
  const { data: appt } = await supabase.from('appointments').select('*').eq('id', appointmentId).single();
  if (!appt || !appt.transfer_request_to_id) return false;

  const targetId = appt.transfer_request_to_id;

  const { error } = await supabase
    .from('appointments')
    .update({
      transfer_request_to_id: null,
      transfer_request_to_name: null,
      transfer_counselor_accepted: null,
      transfer_student_accepted: null
    })
    .eq('id', appointmentId);

  if (error) {
    console.error('Error in cancelTransfer:', error.message);
    return false;
  }

  await createNotification(targetId, `Transfer request for ${appt.student_name} was revoked by ${originalCounselorName}.`);
  await createNotification(appt.student_id, `The transfer request for your appointment was cancelled.`);
  return true;
};

export const getCounselorAvailability = async (counselorId: string): Promise<DayAvailability[]> => {
  const { data, error } = await supabase
    .from('availability')
    .select('*')
    .eq('counselor_id', counselorId);

  if (error || !data) {
    if (error) console.error('Error fetching availability:', error.message);
    return [];
  }

  return data.map((d: any) => ({
    date: d.date,
    slots: d.slots || []
  }));
};

export const saveAvailability = async (counselorId: string, date: string, timeSlots: string[]) => {
  const { data: existing } = await supabase
    .from('availability')
    .select('slots')
    .eq('counselor_id', counselorId)
    .eq('date', date)
    .maybeSingle();

  let finalSlots: TimeSlot[] = timeSlots.map(time => ({
    id: `${date}-${time}`,
    time,
    isBooked: false
  }));

  if (existing && existing.slots) {
    const dbSlots = existing.slots as TimeSlot[];
    finalSlots = finalSlots.map(newSlot => {
      const found = dbSlots.find(dbs => dbs.time === newSlot.time);
      return found ? found : newSlot;
    });
  }

  const { error } = await supabase
    .from('availability')
    .upsert({
      counselor_id: counselorId,
      date,
      slots: finalSlots
    }, { onConflict: 'counselor_id,date' });

  if (error) console.error('Error saving availability:', error.message);
};

export const updateSlotStatus = async (counselorId: string, date: string, time: string, isBooked: boolean) => {
  const { data: existing } = await supabase
    .from('availability')
    .select('slots')
    .eq('counselor_id', counselorId)
    .eq('date', date)
    .maybeSingle();

  if (existing && existing.slots) {
    const updatedSlots = (existing.slots as TimeSlot[]).map(slot => {
      if (slot.time === time) {
        return { ...slot, isBooked };
      }
      return slot;
    });

    const { error } = await supabase
      .from('availability')
      .update({ slots: updatedSlots })
      .eq('counselor_id', counselorId)
      .eq('date', date);
      
    if (error) console.error('Error updating slot status:', error.message);
  }
};

export const subscribeToAppointments = (callback: () => void) => {
  const uniqueId = Math.random().toString(36).substring(7);
  const channel = supabase
    .channel(`public:appointments:${uniqueId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
      callback();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const initMockData = () => {};
