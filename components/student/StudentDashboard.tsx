
import React, { useState, useEffect, useMemo } from 'react';
import { User, Appointment, AppointmentStatus, DayAvailability } from '../../types';
import { saveAppointment, getCounselorAvailability, getAppointments, getCounselors, updateAppointmentStatus, subscribeToAppointments, studentRespondToTransfer, studentRespondToReschedule } from '../../services/storageService';
import { Check, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Download, QrCode, X, MapPin, User as UserIcon, Smile, Trash2, AlertTriangle, ArrowRightLeft, RefreshCw } from 'lucide-react';
import { format, endOfMonth, eachDayOfInterval, addMonths } from 'date-fns';
import QRCode from 'react-qr-code';
import { useNotification } from '../Notifications';

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
  const [counselors, setCounselors] = useState<User[]>([]);

  const [studentIdNumber] = useState(user.studentIdNumber || '');
  const [section] = useState(user.section || '');
  const [parentPhone] = useState(user.parentPhoneNumber || '');
  const [hasConsent, setHasConsent] = useState(false);
  const [selectedCounselorId, setSelectedCounselorId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  
  const [isSuccess, setIsSuccess] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(startOfToday());
  const [availableDates, setAvailableDates] = useState<DayAvailability[]>([]);
  const [viewingQrFor, setViewingQrFor] = useState<Appointment | null>(null);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToAppointments(loadData);
    return () => unsubscribe();
  }, [user.id, activeTab]);

  useEffect(() => {
    if (selectedCounselorId) {
      const fetchAvailability = async () => {
        const avail = await getCounselorAvailability(selectedCounselorId);
        setAvailableDates(avail.filter(d => new Date(d.date) >= startOfToday()));
      };
      fetchAvailability();
      setSelectedDate('');
      setSelectedTime('');
    }
  }, [selectedCounselorId]);

  const loadData = async () => {
    try {
      const counselorList = await getCounselors();
      setCounselors(counselorList);
      const all = await getAppointments();
      const mine = all.filter(a => String(a.studentId) === String(user.id));
      setAppointments(mine.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (e) {
      console.error(e);
    }
  };

  const getFriendlyStatus = (appt: Appointment): string => {
    // If student is at gate or has been accepted/denied for entry, 
    // the appointment is still fundamentally "CONFIRMED" until it's completed.
    if (appt.status === AppointmentStatus.ACCEPTED || appt.status === AppointmentStatus.DENIED) {
      return 'CONFIRMED'; 
    }
    return appt.status;
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCounselorId || !selectedDate || !selectedTime || !reason || !hasConsent) return;
    const counselor = counselors.find(c => String(c.id) === selectedCounselorId);
    const newAppointment: Appointment = {
      id: '', studentId: String(user.id), studentIdNumber, studentName: user.name, section, parentPhoneNumber: parentPhone, hasConsent,
      counselorId: selectedCounselorId, counselorName: counselor?.name || 'Counselor', date: selectedDate, time: selectedTime,
      reason, description, status: AppointmentStatus.PENDING, createdAt: new Date().toISOString()
    };
    const saved = await saveAppointment(newAppointment);
    if (saved) {
      setIsSuccess(true);
      showNotification('Booked!', 'success');
      loadData();
    }
  };

  const QrModal = ({ appt, onClose }: { appt: Appointment, onClose: () => void }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl p-8 flex flex-col items-center">
        <h3 className="text-xl font-bold mb-4">Your Appointment Pass</h3>
        <div className="bg-white p-3 rounded-2xl border-2 border-dashed border-slate-200 mb-6">
          <QRCode value={JSON.stringify({ id: appt.id, student: appt.studentName, date: appt.date, time: appt.time })} size={180} level="M" />
        </div>
        <p className="text-center text-slate-500 text-sm mb-6">Show this code to the gate guard.</p>
        <button onClick={onClose} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold">Done</button>
      </div>
    </div>
  );

  const daysInMonth = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });

  if (activeTab === 'my-appointments') {
    return (
      <div className="pb-32 px-6 pt-6 animate-in fade-in slide-in-from-right-4 duration-300">
        <h2 className="text-2xl font-bold mb-6">Your History</h2>
        <div className="space-y-4">
          {appointments.length === 0 ? (
            <div className="py-12 text-center text-slate-400">No appointments yet.</div>
          ) : (
            appointments.map(apt => (
              <div key={apt.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                 <div className="flex justify-between items-start mb-2">
                   <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      apt.status === AppointmentStatus.PENDING ? 'bg-amber-100 text-amber-700' :
                      apt.status === AppointmentStatus.CANCELLED ? 'bg-red-100 text-red-700' :
                      apt.status === AppointmentStatus.COMPLETED ? 'bg-emerald-100 text-emerald-700' :
                      'bg-blue-100 text-blue-700'
                   }`}>
                     {getFriendlyStatus(apt)}
                   </span>
                 </div>
                 <h3 className="text-lg font-bold">{apt.reason}</h3>
                 <p className="text-slate-500 text-sm">{apt.counselorName} • {format(parseISO(apt.date), 'MMM d')} at {apt.time}</p>
                 {apt.status === AppointmentStatus.CONFIRMED && (
                    <button onClick={() => setViewingQrFor(apt)} className="mt-4 w-full flex items-center justify-center gap-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold transition-all active:scale-95"><QrCode size={16} /> View QR Code</button>
                 )}
              </div>
            ))
          )}
        </div>
        {viewingQrFor && <QrModal appt={viewingQrFor} onClose={() => setViewingQrFor(null)} />}
      </div>
    );
  }

  return (
    <div className="pb-32 px-4 pt-6 animate-in fade-in slide-in-from-left-4 duration-300">
      <form onSubmit={handleBook} className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold mb-4">Book New Session</h3>
          <div className="space-y-4">
            <select required value={reason} onChange={e => setReason(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium">
              <option value="">Reason for Counseling?</option>
              {['Academic Stress', 'Career Guidance', 'Personal Issues', 'Other'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select required value={selectedCounselorId} onChange={e => setSelectedCounselorId(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium">
              <option value="">Choose Counselor</option>
              {counselors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className={`transition-all ${selectedCounselorId ? 'opacity-100' : 'opacity-50 pointer-events-none grayscale'}`}>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
             <div className="flex items-center justify-between mb-4">
               <button type="button" onClick={() => setCurrentMonth(addMonths(currentMonth, -1))} className="p-1 hover:bg-slate-100 rounded-full"><ChevronLeft /></button>
               <span className="font-bold">{format(currentMonth, 'MMMM yyyy')}</span>
               <button type="button" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 hover:bg-slate-100 rounded-full"><ChevronRight /></button>
             </div>
             <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400 mb-2">
               {['S','M','T','W','T','F','S'].map(d => <div key={d}>{d}</div>)}
             </div>
             <div className="grid grid-cols-7 gap-1">
               {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => <div key={i} />)}
               {daysInMonth.map(date => {
                 const dateStr = format(date, 'yyyy-MM-dd');
                 const isSelected = selectedDate === dateStr;
                 const dayAvail = availableDates.find(d => d.date === dateStr);
                 return (
                   <button key={dateStr} type="button" onClick={() => setSelectedDate(dateStr)} disabled={!dayAvail || dayAvail.slots.every(s => s.isBooked)} className={`h-9 rounded-lg flex items-center justify-center text-sm transition-all ${isSelected ? 'bg-indigo-600 text-white font-bold shadow-md' : dayAvail ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'text-slate-300'}`}>
                     {format(date, 'd')}
                   </button>
                 );
               })}
             </div>
             {selectedDate && (
               <div className="grid grid-cols-3 gap-2 mt-6 animate-in slide-in-from-top-2 duration-300">
                 {availableDates.find(d => d.date === selectedDate)?.slots.filter(s => !s.isBooked).map(s => (
                   <button key={s.time} type="button" onClick={() => setSelectedTime(s.time)} className={`py-2 rounded-lg border text-sm font-bold transition-all ${selectedTime === s.time ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>{s.time}</button>
                 ))}
               </div>
             )}
          </div>
        </div>

        <div className="bg-indigo-600 p-6 rounded-2xl text-white shadow-lg shadow-indigo-200">
          <label className="flex gap-3 cursor-pointer select-none">
            <input type="checkbox" required checked={hasConsent} onChange={e => setHasConsent(e.target.checked)} className="h-5 w-5 rounded border-2 border-indigo-400 bg-indigo-500 checked:bg-white" />
            <span className="text-xs font-medium leading-relaxed">I consent to the collection and processing of my personal data for guidance purposes.</span>
          </label>
        </div>

        <button type="submit" disabled={!selectedTime} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl disabled:opacity-50 transition-all active:scale-[0.98]">Confirm Appointment</button>
      </form>

      {isSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-6">
          <div className="bg-white rounded-[2rem] overflow-hidden shadow-2xl p-10 flex flex-col items-center animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
              <Check size={40} className="text-emerald-600" />
            </div>
            <h3 className="text-2xl font-black mb-2">Booked!</h3>
            <p className="text-slate-500 text-center mb-8">Your counseling session is confirmed. View your pass in the Status tab.</p>
            <button onClick={() => setIsSuccess(false)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-lg">Great</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
