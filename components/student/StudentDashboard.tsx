
import React, { useState, useEffect, useMemo } from 'react';
import { User, Appointment, AppointmentStatus, DayAvailability } from '../../types';
import { saveAppointment, getCounselorAvailability, getAppointments, getCounselors, updateAppointmentStatus, subscribeToAppointments, studentRespondToTransfer, studentRespondToReschedule } from '../../services/storageService';
import { Check, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, X, MapPin, User as UserIcon, Smile, Trash2, AlertTriangle, ArrowRightLeft, RefreshCw } from 'lucide-react';
import { format, endOfMonth, eachDayOfInterval, addMonths } from 'date-fns';
import { useNotification } from '../Notifications';

// Polyfills for missing date-fns exports
const parseISO = (str: string) => new Date(str.includes('T') ? str : str + 'T00:00:00');
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

interface StudentDashboardProps {
  user: User;
  activeTab: string;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ user, activeTab }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const { showNotification } = useNotification();
  
  // Data State
  const [counselors, setCounselors] = useState<User[]>([]);

  // Form State
  const [studentIdNumber, setStudentIdNumber] = useState(user.studentIdNumber || '');
  const [section, setSection] = useState(user.section || '');
  const [parentPhone, setParentPhone] = useState(user.parentPhoneNumber || '');
  const [hasConsent, setHasConsent] = useState(false);
  const [selectedCounselorId, setSelectedCounselorId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  
  // UI State
  const [isSuccess, setIsSuccess] = useState(false);
  const [lastBookedAppointment, setLastBookedAppointment] = useState<Appointment | null>(null);
  const [currentMonth, setCurrentMonth] = useState(startOfToday());
  const [availableDates, setAvailableDates] = useState<DayAvailability[]>([]);
  const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToAppointments(() => {
        loadData();
    });
    return () => {
        unsubscribe();
    };
  }, [user.id, activeTab]);

  useEffect(() => {
    if (selectedCounselorId) {
      const fetchAvailability = async () => {
        const avail = await getCounselorAvailability(selectedCounselorId);
        const valid = avail.filter(d => 
          new Date(d.date) >= new Date(new Date().setHours(0,0,0,0))
        );
        setAvailableDates(valid);
      };
      fetchAvailability();
      setSelectedDate('');
      setSelectedTime('');
    } else {
      setAvailableDates([]);
    }
  }, [selectedCounselorId]);

  const loadData = async () => {
    try {
      const counselorList = await getCounselors();
      setCounselors(counselorList);

      const all = await getAppointments();
      // Ensure we compare strings to avoid type mismatch (e.g. "105" vs 105)
      const currentUserId = String(user.id);
      const mine = all.filter(a => String(a.studentId) === currentUserId);
      setAppointments(mine.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (e) {
      console.error("Error loading student data:", e);
    }
  };

  // Check for conflicts with existing appointments
  const bookingConflict = useMemo(() => {
    if (!selectedDate || !selectedTime) return null;
    
    // Find any pending or confirmed appointment at the same time
    const conflict = appointments.find(a => 
      (a.status === AppointmentStatus.PENDING || a.status === AppointmentStatus.CONFIRMED) &&
      a.date === selectedDate &&
      a.time === selectedTime
    );

    if (conflict) return { type: 'exact', appointment: conflict };

    // Find any pending or confirmed appointment on the same day (policy: 1 per day)
    const dayConflict = appointments.find(a => 
      (a.status === AppointmentStatus.PENDING || a.status === AppointmentStatus.CONFIRMED) &&
      a.date === selectedDate
    );

    if (dayConflict) return { type: 'day', appointment: dayConflict };

    return null;
  }, [appointments, selectedDate, selectedTime]);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (bookingConflict && bookingConflict.type === 'exact') {
      showNotification('You already have an appointment scheduled for this exact time.', 'error');
      return;
    }

    if (!selectedCounselorId || !selectedDate || !selectedTime || !reason || !studentIdNumber || !section || !parentPhone || !hasConsent) {
      showNotification('Please fill in all required fields and check consent.', 'error');
      return;
    }

    if (reason === 'Other' && !description.trim()) {
      showNotification('Please specify your reason in the text box.', 'error');
      return;
    }

    const counselor = counselors.find(c => String(c.id) === selectedCounselorId);
    
    const newAppointmentRequest: Appointment = {
      id: '', 
      studentId: String(user.id),
      studentName: user.name,
      studentIdNumber,
      section,
      parentPhoneNumber: parentPhone,
      hasConsent,
      counselorId: selectedCounselorId,
      counselorName: counselor?.name || 'Counselor',
      date: selectedDate,
      time: selectedTime,
      reason,
      description,
      status: AppointmentStatus.PENDING,
      createdAt: new Date().toISOString()
    };

    const savedAppointment = await saveAppointment(newAppointmentRequest);
    
    if (savedAppointment) {
        setLastBookedAppointment(savedAppointment);
        setIsSuccess(true);
        showNotification('Appointment request sent successfully!', 'success');
        loadData(); 
    } else {
        showNotification('Failed to save appointment. You might already have a conflict.', 'error');
    }
  };

  const handleStudentTransferResponse = async (apptId: string, accept: boolean) => {
    const success = await studentRespondToTransfer(apptId, accept);
    if (success) {
      showNotification(accept ? 'Transfer request approved.' : 'Transfer request declined.', 'success');
      loadData();
    } else {
      showNotification('Failed to process transfer request.', 'error');
    }
  };

  const handleRescheduleResponse = async (apptId: string, accept: boolean) => {
    const success = await studentRespondToReschedule(apptId, accept);
    if (success) {
      showNotification(accept ? 'Reschedule confirmed!' : 'Reschedule proposal declined.', 'success');
      loadData();
    } else {
      showNotification('Failed to process reschedule response.', 'error');
    }
  };

  const handleCancelClick = (appt: Appointment) => {
    setAppointmentToCancel(appt);
  };

  const confirmCancellation = async () => {
    if (!appointmentToCancel) return;
    await updateAppointmentStatus(appointmentToCancel.id, AppointmentStatus.CANCELLED);
    showNotification('Appointment cancelled successfully.', 'success');
    setAppointmentToCancel(null);
    loadData();
  };

  const resetForm = () => {
    setIsSuccess(false);
    setLastBookedAppointment(null);
    setSelectedCounselorId('');
    setSelectedDate('');
    setSelectedTime('');
    setDescription('');
    setReason('');
  };

  const REASONS = ['Academic Stress', 'Career Guidance', 'Personal Issues', 'Other'];

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(addMonths(currentMonth, -1));

  const getDateStatus = (dateStr: string): 'unavailable' | 'available' | 'fully-booked' => {
    const dayAvail = availableDates.find(d => d.date === dateStr);
    if (!dayAvail) return 'unavailable';
    const hasOpenSlot = dayAvail.slots.some(s => !s.isBooked);
    return hasOpenSlot ? 'available' : 'fully-booked';
  };

  const getSlotsForDate = (dateStr: string) => {
    return availableDates.find(d => d.date === dateStr)?.slots.filter(s => !s.isBooked) || [];
  };

  const WelcomeHeader = () => (
     <div className="px-6 pt-6 pb-2">
      <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
        Hello, {user.name.split(' ')[0]} <span className="text-2xl">👋</span>
      </h1>
      <p className="text-slate-500 text-sm mt-1">How can we support you today?</p>
    </div>
  );

  if (activeTab === 'my-appointments') {
    return (
      <div className="pb-32 animate-in fade-in slide-in-from-right-4 duration-300">
        <WelcomeHeader />
        <div className="px-4 mt-4">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 px-2">Your History</h2>
          
          {appointmentToCancel && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 p-6">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="text-red-600" size={24} />
                </div>
                <h3 className="text-lg font-bold text-center text-slate-900 mb-2">Cancel Request?</h3>
                <p className="text-center text-slate-500 text-sm mb-6">
                  Are you sure you want to cancel your appointment with <span className="font-semibold text-slate-800">{appointmentToCancel.counselorName}</span>?
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setAppointmentToCancel(null)} className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors text-sm">No, Keep it</button>
                  <button onClick={confirmCancellation} className="py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-colors text-sm shadow-lg shadow-red-200">Yes, Cancel</button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {appointments.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl text-center border border-dashed border-slate-300 mt-4">
                <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"><CalendarIcon className="w-8 h-8 text-slate-300" /></div>
                <p className="text-slate-500 font-medium">No appointments yet.</p>
                <p className="text-xs text-slate-400 mt-1">Book your first session in the Book tab.</p>
              </div>
            ) : (
              appointments.map(apt => {
                const isTransferring = apt.transferRequestToId && !apt.transferStudentAccepted;
                const isRescheduling = !!apt.rescheduleProposedDate;

                return (
                  <div key={apt.id} className={`bg-white rounded-2xl border shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] overflow-hidden transition-all ${isTransferring || isRescheduling ? 'border-amber-300 ring-2 ring-amber-50' : 'border-slate-200'}`}>
                     {isTransferring && (
                        <div className="bg-purple-600 text-white p-3 flex items-center gap-2">
                          <ArrowRightLeft size={16} />
                          <span className="text-xs font-bold uppercase tracking-wider">Transfer Approval Needed</span>
                        </div>
                     )}
                     {isRescheduling && !isTransferring && (
                        <div className="bg-amber-500 text-white p-3 flex items-center gap-2">
                          <RefreshCw size={16} className="animate-spin-slow" />
                          <span className="text-xs font-bold uppercase tracking-wider">Reschedule Request</span>
                        </div>
                     )}
                     <div className="p-5 border-b border-slate-50 relative">
                       <div className="flex justify-between items-start mb-3">
                         <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm ${
                           apt.status === AppointmentStatus.PENDING ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                           apt.status === AppointmentStatus.CONFIRMED ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                           apt.status === AppointmentStatus.CANCELLED ? 'bg-red-100 text-red-700 border border-red-200' :
                           'bg-emerald-100 text-emerald-700 border border-emerald-200'
                         }`}>
                           {apt.status}
                         </span>
                         <p className="text-[10px] font-mono text-slate-300">#{apt.id.slice(0, 4)}</p>
                       </div>
                       <h3 className="text-lg font-bold text-slate-900 mb-1">{apt.reason}</h3>
                       <div className="flex items-center gap-2 text-slate-500 text-sm">
                         <UserIcon size={14} className="text-indigo-400" />
                         <span>{apt.counselorName}</span>
                       </div>
                     </div>
                     <div className="p-5 bg-slate-50/50">
                       {isTransferring ? (
                         <div className="bg-white p-4 rounded-xl border border-purple-100 mb-3 shadow-inner">
                            <p className="text-xs text-slate-600 mb-3 text-center">
                               Counselor <strong>{apt.counselorName}</strong> has requested to transfer your session to <strong>{apt.transferRequestToName}</strong>. Do you approve?
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                               <button 
                                 onClick={() => handleStudentTransferResponse(apt.id, true)}
                                 className="flex items-center justify-center gap-2 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700"
                               >
                                 <Check size={14} /> Approve
                               </button>
                               <button 
                                 onClick={() => handleStudentTransferResponse(apt.id, false)}
                                 className="flex items-center justify-center gap-2 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50"
                               >
                                 <X size={14} /> Decline
                               </button>
                            </div>
                         </div>
                       ) : isRescheduling ? (
                         <div className="bg-white p-4 rounded-xl border border-amber-200 mb-3 shadow-sm">
                            <div className="flex items-center justify-center gap-3 mb-4">
                               <div className="text-center">
                                  <p className="text-[9px] font-bold text-slate-400 uppercase">Current</p>
                                  <p className="text-xs font-bold text-slate-500 line-through">{format(parseISO(apt.date), 'MMM d')} • {apt.time}</p>
                               </div>
                               <ArrowRightLeft size={16} className="text-amber-500" />
                               <div className="text-center">
                                  <p className="text-[9px] font-bold text-amber-500 uppercase">New Proposal</p>
                                  <p className="text-xs font-bold text-slate-900">{apt.rescheduleProposedDate ? format(parseISO(apt.rescheduleProposedDate), 'MMM d') : '-'} • {apt.rescheduleProposedTime}</p>
                               </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                               <button 
                                 onClick={() => handleRescheduleResponse(apt.id, true)}
                                 className="flex items-center justify-center gap-2 py-2 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600"
                               >
                                 <Check size={14} /> Accept New Time
                               </button>
                               <button 
                                 onClick={() => handleRescheduleResponse(apt.id, false)}
                                 className="flex items-center justify-center gap-2 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50"
                               >
                                 <X size={14} /> Decline
                               </button>
                            </div>
                         </div>
                       ) : (
                         <div className="flex items-center gap-4 mb-4 bg-white p-3 rounded-xl border border-slate-100">
                           <div className="flex-1 text-center border-r border-slate-100">
                             <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Date</p>
                             <p className="text-slate-800 font-bold text-sm">{format(parseISO(apt.date), 'MMM d')}</p>
                           </div>
                           <div className="flex-1 text-center">
                             <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Time</p>
                             <p className="text-slate-800 font-bold text-sm">{apt.time}</p>
                           </div>
                         </div>
                       )}

                       <div className="flex flex-col gap-2">
                        {apt.status === AppointmentStatus.PENDING && !isTransferring && !isRescheduling && (
                          <button 
                            onClick={() => handleCancelClick(apt)}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 border border-red-100 rounded-xl text-red-600 font-semibold shadow-sm hover:bg-red-100 active:scale-[0.98] transition-all text-sm"
                          ><Trash2 size={16} /> Cancel Request</button>
                        )}
                       </div>
                     </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-32 animate-in fade-in slide-in-from-left-4 duration-300">
      <WelcomeHeader />
      <div className="px-4 mt-2">
        <form onSubmit={handleBook} className="space-y-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-2 text-indigo-600 font-semibold border-b border-slate-100 pb-3 mb-4">
              <div className="p-1.5 bg-indigo-50 rounded-lg"><UserIcon size={16} /></div>
              <h3 className="text-sm">Student Info</h3>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Student ID</label>
                  <input type="text" readOnly value={studentIdNumber} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Section</label>
                  <input type="text" readOnly value={section} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium text-sm outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Full Name</label>
                <input type="text" value={user.name} disabled className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium text-sm" />
              </div>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-2 text-indigo-600 font-semibold border-b border-slate-100 pb-3 mb-4">
               <div className="p-1.5 bg-indigo-50 rounded-lg"><MapPin size={16} /></div>
              <h3 className="text-sm">Session Details</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Reason for Counseling</label>
                <div className="relative">
                  <select required value={reason} onChange={(e) => setReason(e.target.value)} className="w-full appearance-none px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium text-sm text-slate-700 shadow-sm">
                    <option value="">What's on your mind?</option>
                    {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><ChevronRight size={18} className="rotate-90" /></div>
                </div>
              </div>
              {reason && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{reason === 'Other' ? 'Please Specify Reason (Required)' : 'Note (Optional)'}</label>
                  <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} required={reason === 'Other'} placeholder={reason === 'Other' ? "Please specify your reason..." : "Anything else needed?"} className={`w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none resize-none font-medium text-sm ${reason === 'Other' && !description ? 'border-amber-300 ring-2 ring-amber-100' : ''}`} />
                </div>
              )}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Counselor</label>
                <div className="relative">
                  <select required value={selectedCounselorId} onChange={(e) => setSelectedCounselorId(e.target.value)} className="w-full appearance-none px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium text-sm text-slate-700 shadow-sm">
                    <option value="">Select a Counselor...</option>
                    {counselors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><ChevronRight size={18} className="rotate-90" /></div>
                </div>
              </div>
            </div>
          </div>
          <div className={`transition-all duration-300 ${selectedCounselorId ? 'opacity-100' : 'opacity-40 pointer-events-none grayscale'}`}>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-2 text-indigo-600 font-semibold border-b border-slate-100 pb-3 mb-4">
                 <div className="p-1.5 bg-indigo-50 rounded-lg"><CalendarIcon size={16} /></div>
                <h3 className="text-sm">Date & Time</h3>
              </div>
              <div className="flex items-center justify-between mb-4 bg-slate-50 p-2 rounded-xl">
                <button type="button" onClick={prevMonth} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600"><ChevronLeft size={18} /></button>
                <span className="font-bold text-slate-800 text-sm">{format(currentMonth, 'MMMM yyyy')}</span>
                <button type="button" onClick={nextMonth} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600"><ChevronRight size={18} /></button>
              </div>
              <div className="grid grid-cols-7 gap-y-2 gap-x-1 text-center mb-6">
                {['S','M','T','W','T','F','S'].map(d => <div key={d} className="text-[10px] font-bold text-slate-400">{d}</div>)}
                {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => <div key={`empty-${i}`} />)}
                {daysInMonth.map(date => {
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const status = getDateStatus(dateStr);
                  const isSelected = selectedDate === dateStr;
                  const isPast = date < new Date(new Date().setHours(0,0,0,0));
                  return (
                    <button key={dateStr} type="button" disabled={status === 'unavailable' || status === 'fully-booked' || isPast} onClick={() => { setSelectedDate(dateStr); setSelectedTime(''); }} className={`h-9 w-full rounded-lg flex items-center justify-center text-sm transition-all relative ${isSelected ? 'bg-indigo-600 text-white font-bold shadow-md' : ''} ${!isSelected && status === 'available' && !isPast ? 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200 font-medium' : ''} ${!isSelected && status === 'fully-booked' && !isPast ? 'text-red-400 bg-red-50 cursor-not-allowed' : ''} ${!isSelected && (status === 'unavailable' || isPast) ? 'text-slate-300 bg-transparent' : ''}`}>{format(date, 'd')}</button>
                  );
                })}
              </div>
              {selectedDate && (
                <div className="animate-in slide-in-from-top-2 pt-4 border-t border-slate-100">
                  <h3 className="font-semibold text-slate-800 mb-3 text-xs uppercase tracking-wide">Available Slots</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {getSlotsForDate(selectedDate).map(slot => (
                      <button key={slot.time} type="button" onClick={() => setSelectedTime(slot.time)} className={`py-2 px-2 rounded-lg text-sm font-medium border transition-all ${selectedTime === slot.time ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-[1.02]' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'}`}>{slot.time}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Conflict Warning */}
          {bookingConflict && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-start gap-3 animate-in shake duration-300">
              <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-bold text-red-800">
                  {bookingConflict.type === 'exact' 
                    ? 'Time Slot Conflict' 
                    : 'Daily Appointment Limit'}
                </p>
                <p className="text-xs text-red-600 mt-1 leading-relaxed">
                  {bookingConflict.type === 'exact'
                    ? `You already have a ${bookingConflict.appointment.status.toLowerCase()} appointment with ${bookingConflict.appointment.counselorName} at this exact time.`
                    : `You already have a ${bookingConflict.appointment.status.toLowerCase()} appointment on this day. Please manage your existing schedule first.`
                  }
                </p>
              </div>
            </div>
          )}

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)]">
             <div className="flex items-center gap-2 text-indigo-600 font-semibold border-b border-slate-100 pb-3 mb-4">
                 <div className="p-1.5 bg-indigo-50 rounded-lg"><Smile size={16} /></div>
                <h3 className="text-sm">Final Touches</h3>
              </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Guardian Phone</label>
                <input type="tel" required readOnly value={parentPhone} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium cursor-not-allowed outline-none text-sm" />
              </div>
            </div>
          </div>
          <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-200 text-white">
             <label className="flex items-start gap-3 cursor-pointer select-none">
                <div className="relative flex items-center mt-0.5">
                  <input type="checkbox" required checked={hasConsent} onChange={(e) => setHasConsent(e.target.checked)} className="peer h-5 w-5 cursor-pointer appearance-none rounded border-2 border-indigo-300 checked:border-white checked:bg-white transition-all bg-indigo-700" />
                  <Check className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600 opacity-0 peer-checked:opacity-100" size={14} strokeWidth={4} />
                </div>
                <span className="text-xs text-indigo-100 leading-relaxed font-medium">I consent to the collection and processing of my personal data for guidance counseling purposes.</span>
              </label>
          </div>
          <button 
            type="submit" 
            disabled={!!(bookingConflict && bookingConflict.type === 'exact') || !selectedTime}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
          >
            {(bookingConflict && bookingConflict.type === 'exact') ? 'Time Slot Conflict' : 'Confirm Appointment'}
          </button>
        </form>
        {isSuccess && lastBookedAppointment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-md animate-in fade-in">
             <div className="bg-white w-full max-sm rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95">
               <div className="bg-emerald-500 p-8 text-center text-white relative">
                 <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md shadow-inner"><Check size={32} className="text-white" strokeWidth={3} /></div>
                 <h3 className="text-2xl font-bold">Booked!</h3>
                 <p className="text-emerald-100 mt-2 text-sm">Your session is confirmed.</p>
               </div>
               <div className="p-8 flex flex-col items-center">
                 <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-6 w-full text-center">
                    <p className="text-sm font-bold text-slate-700 mb-1">Appointment ID</p>
                    <p className="text-2xl font-mono font-black text-indigo-600 tracking-wider">#{lastBookedAppointment.id.slice(0, 8).toUpperCase()}</p>
                 </div>
                 <p className="text-center text-slate-500 text-xs mb-6 px-4">Please present your Appointment ID at the Guidance Office.</p>
                 <div className="w-full space-y-3">
                    <button onClick={resetForm} className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors">Close</button>
                 </div>
               </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;
    