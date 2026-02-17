
import React, { useState, useEffect, useMemo } from 'react';
import { User, Appointment, AppointmentStatus, DayAvailability } from '../../types';
import { getAppointments, updateAppointmentStatus, rescheduleAppointment, cancelRescheduleProposal, getCounselorAvailability, subscribeToAppointments, getCounselors, initiateTransfer, respondToTransfer, cancelTransfer } from '../../services/storageService';
import { Clock, CheckCircle, XCircle, Phone, Hash, BookOpen, CalendarDays, RefreshCw, ArrowRightLeft, UserCheck, Loader2, X, Search, SortAsc, SortDesc, ChevronLeft, ChevronRight, Ban, LayoutList, Calendar as CalendarIcon, Filter, Footprints, ShieldCheck } from 'lucide-react';
import AvailabilityManager from './AvailabilityManager';
import { format, endOfMonth, eachDayOfInterval, addMonths, endOfWeek, isSameMonth, isSameDay, isToday } from 'date-fns';
import { useNotification } from '../Notifications';
import { supabase } from '../../services/supabaseClient';

// Polyfills for missing date-fns exports
const parseISO = (str: string) => new Date(str.includes('T') ? str : str + 'T00:00:00');
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const startOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  const newDate = new Date(d.setDate(diff));
  newDate.setHours(0, 0, 0, 0);
  return newDate;
};

interface CounselorDashboardProps {
  user: User;
  activeTab: string;
}

type SortField = 'date' | 'name' | 'status';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'list' | 'calendar';

const CounselorDashboard: React.FC<CounselorDashboardProps> = ({ user, activeTab }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [counselors, setCounselors] = useState<User[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [isLoading, setIsLoading] = useState(true);
  const { showNotification } = useNotification();
  
  // View Mode State
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Reschedule State
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleTime, setRescheduleTime] = useState<string>('');
  const [rescheduleCalendarMonth, setRescheduleCalendarMonth] = useState(new Date());
  const [ownAvailability, setOwnAvailability] = useState<DayAvailability[]>([]);
  const [isRescheduling, setIsRescheduling] = useState(false);

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferApptId, setTransferApptId] = useState<string | null>(null);
  const [targetCounselorId, setTargetCounselorId] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState(false);

  useEffect(() => {
    loadInitialData();
    const unsubscribe = subscribeToAppointments(() => {
      refreshAppointments();
    });
    return () => unsubscribe();
  }, [user.id]);

  useEffect(() => {
    // Listen for high-priority gate notifications (Gatekeeper App updates via 'notifications' table)
    const gateChannel = supabase
      .channel('gate_alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const msg = payload.new.message;
          if (msg && msg.startsWith('GATE_UPDATE:')) {
            const studentInfo = msg.replace('GATE_UPDATE:', '').trim();
            showNotification(`Student Incoming: ${studentInfo} is on their way to the Guidance Office.`, 'incoming');
            refreshAppointments(); 
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(gateChannel);
    };
  }, [user.id, showNotification]);

  useEffect(() => {
    if (rescheduleId) {
      loadOwnAvailability();
    }
  }, [rescheduleId]);

  const loadOwnAvailability = async () => {
    const data = await getCounselorAvailability(user.id);
    setOwnAvailability(data);
  };

  const loadInitialData = async () => {
    setIsLoading(true);
    await Promise.all([loadAppointments(), loadCounselors()]);
    setIsLoading(false);
  };

  const loadCounselors = async () => {
    try {
      const list = await getCounselors();
      setCounselors(list.filter(c => String(c.id).toLowerCase() !== String(user.id).toLowerCase()));
    } catch (e) {
      console.error("Failed to load counselors", e);
    }
  };

  const loadAppointments = async () => {
    try {
      const all = await getAppointments();
      const currentUserId = String(user.id).toLowerCase();
      
      const mine = all.filter(a => {
        const isOwner = String(a.counselorId).toLowerCase() === currentUserId;
        const isTransferTarget = a.transferRequestToId && String(a.transferRequestToId).toLowerCase() === currentUserId;
        return isOwner || isTransferTarget;
      });
      
      setAppointments(mine);
    } catch (e) {
      console.error("Failed to load appointments", e);
      showNotification("Database sync failed. Retrying...", "error");
    }
  };

  const refreshAppointments = async () => {
    const all = await getAppointments();
    const currentUserId = String(user.id).toLowerCase();
    
    const mine = all.filter(a => {
      const isOwner = String(a.counselorId).toLowerCase() === currentUserId;
      const isTransferTarget = a.transferRequestToId && String(a.transferRequestToId).toLowerCase() === currentUserId;
      return isOwner || isTransferTarget;
    });
    setAppointments(mine);
  };

  const handleStatusChange = async (id: string, status: AppointmentStatus) => {
    await updateAppointmentStatus(id, status);
    showNotification(`Appointment marked as ${status.toLowerCase()}`, 'success');
    refreshAppointments();
  };

  const handleRescheduleConfirm = async () => {
    if (!rescheduleId || !rescheduleDate || !rescheduleTime) return;
    setIsRescheduling(true);
    const success = await rescheduleAppointment(rescheduleId, rescheduleDate, rescheduleTime);
    setIsRescheduling(false);
    
    if (success) {
      showNotification('Reschedule proposal sent to student for approval.', 'success');
      setRescheduleId(null);
      setRescheduleDate('');
      setRescheduleTime('');
      refreshAppointments();
    } else {
      showNotification('Failed to send reschedule request. See console for details.', 'error');
    }
  };

  const handleCancelReschedule = async (id: string) => {
    const success = await cancelRescheduleProposal(id);
    if (success) {
      showNotification('Reschedule request retracted.', 'info');
      refreshAppointments();
    } else {
      showNotification('Failed to cancel reschedule proposal.', 'error');
    }
  };

  const filteredAndSortedAppointments = useMemo(() => {
    let result = appointments.filter(a => {
      const matchesFilter = filter === 'all' || a.status === filter;
      const studentName = (a.studentName || '').toLowerCase();
      const studentId = (a.studentIdNumber || '').toLowerCase();
      const query = searchQuery.toLowerCase();
      
      const matchesSearch = studentName.includes(query) || studentId.includes(query);
      
      // If a date is selected in calendar mode, filter by that date
      const matchesDate = !selectedDate || (a.date === format(selectedDate, 'yyyy-MM-dd'));

      return matchesFilter && matchesSearch && matchesDate;
    });

    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        const timeA = a.date && a.time ? new Date(`${a.date}T${a.time}`).getTime() : 0;
        const timeB = b.date && b.time ? new Date(`${b.date}T${b.time}`).getTime() : 0;
        comparison = (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB);
      } else if (sortBy === 'name') {
        comparison = (a.studentName || '').localeCompare(b.studentName || '');
      } else if (sortBy === 'status') {
        comparison = (a.status || '').localeCompare(b.status || '');
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [appointments, filter, searchQuery, sortBy, sortOrder, selectedDate]);

  // Appointments grouped by date for Calendar dots
  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    // Use the filtered list (search + status) but ignoring the selectedDate filter
    // so we can see dots for all relevant appointments
    const baseList = appointments.filter(a => {
        const matchesFilter = filter === 'all' || a.status === filter;
        const studentName = (a.studentName || '').toLowerCase();
        const studentId = (a.studentIdNumber || '').toLowerCase();
        const query = searchQuery.toLowerCase();
        return matchesFilter && (studentName.includes(query) || studentId.includes(query));
    });

    baseList.forEach(app => {
      if (!app.date) return;
      if (!map.has(app.date)) map.set(app.date, []);
      map.get(app.date)?.push(app);
    });
    return map;
  }, [appointments, filter, searchQuery]);

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const openTransferModal = (apptId: string) => {
    setTransferApptId(apptId);
    setTransferModalOpen(true);
    setTargetCounselorId('');
  };

  const submitTransfer = async () => {
    if (!transferApptId || !targetCounselorId) return;
    setIsTransferring(true);
    const target = counselors.find(c => String(c.id).toLowerCase() === String(targetCounselorId).toLowerCase());
    if (!target) {
        setIsTransferring(false);
        return;
    }
    const result = await initiateTransfer(transferApptId, target.id, target.name);
    setIsTransferring(false);
    if (result.success) {
      showNotification(result.message, 'success');
      setTransferModalOpen(false);
      setTransferApptId(null);
      refreshAppointments();
    } else {
      showNotification(result.message, 'error');
    }
  };

  const handleCancelTransfer = async (apptId: string) => {
     const success = await cancelTransfer(apptId, user.name);
     if (success) {
        showNotification('Transfer request revoked.', 'success');
        refreshAppointments();
     } else {
        showNotification('Failed to cancel transfer.', 'error');
     }
  };

  const daysInRescheduleMonth = useMemo(() => {
    return eachDayOfInterval({
      start: startOfMonth(rescheduleCalendarMonth),
      end: endOfMonth(rescheduleCalendarMonth),
    });
  }, [rescheduleCalendarMonth]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [calendarDate]);

  const getDateStatus = (dateStr: string) => {
    const dayData = ownAvailability.find(d => d.date === dateStr);
    if (!dayData || dayData.slots.length === 0) return 'empty';
    const hasOpenSlot = dayData.slots.some(s => !s.isBooked);
    return hasOpenSlot ? 'available' : 'fully-booked';
  };

  const getSlotsForDate = (dateStr: string) => {
    return ownAvailability.find(d => d.date === dateStr)?.slots.filter(s => !s.isBooked) || [];
  };

  // Helper to get color for dots
  const getStatusColor = (status: AppointmentStatus) => {
    switch (status) {
        case AppointmentStatus.PENDING: return 'bg-amber-400';
        case AppointmentStatus.CONFIRMED: return 'bg-blue-500';
        case AppointmentStatus.COMPLETED: return 'bg-emerald-500';
        case AppointmentStatus.CANCELLED: return 'bg-red-500';
        case AppointmentStatus.DEPARTED: return 'bg-cyan-500';
        default: return 'bg-slate-400';
    }
  };

  if (activeTab === 'availability') return <AvailabilityManager user={user} />;

  return (
    <div className="space-y-6 relative">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              Appointment Management
              {isLoading && <Loader2 className="animate-spin text-indigo-500" size={20} />}
            </h2>
            <p className="text-slate-500">View and manage student appointment requests</p>
          </div>
          
          <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
             <button
               onClick={() => { setViewMode('list'); setSelectedDate(null); }}
               className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                 viewMode === 'list' 
                   ? 'bg-indigo-100 text-indigo-700 shadow-sm' 
                   : 'text-slate-600 hover:bg-slate-50'
               }`}
             >
               <LayoutList size={16} /> List
             </button>
             <button
               onClick={() => setViewMode('calendar')}
               className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                 viewMode === 'calendar' 
                   ? 'bg-indigo-100 text-indigo-700 shadow-sm' 
                   : 'text-slate-600 hover:bg-slate-50'
               }`}
             >
               <CalendarIcon size={16} /> Calendar
             </button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search student name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">
                 <Filter size={14} /> Filter:
              </span>
              {['all', AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.DEPARTED, AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED].map(f => (
                <button 
                  key={f} 
                  onClick={() => setFilter(f)} 
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border shrink-0 ${
                    filter === f 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                      : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  {f === AppointmentStatus.DEPARTED ? 'INCOMING' : f}
                </button>
              ))}
            </div>
          </div>

          {viewMode === 'list' && (
            <div className="flex items-center gap-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sort by:</span>
              <div className="flex gap-2">
                {[
                  { field: 'date' as SortField, label: 'Date & Time' },
                  { field: 'name' as SortField, label: 'Student Name' },
                  { field: 'status' as SortField, label: 'Status' },
                ].map((s) => (
                  <button
                    key={s.field}
                    onClick={() => toggleSort(s.field)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                      sortBy === s.field 
                        ? 'bg-slate-100 border-slate-300 text-slate-900' 
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {s.label}
                    {sortBy === s.field && (
                      sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>
      
      {/* View Mode: Calendar */}
      {viewMode === 'calendar' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
           <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 flex items-center justify-between border-b border-slate-200 bg-slate-50">
                 <button onClick={() => setCalendarDate(addMonths(calendarDate, -1))} className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200 shadow-sm hover:shadow">
                   <ChevronLeft size={20} className="text-slate-600" />
                 </button>
                 <h2 className="text-lg font-bold text-slate-800">{format(calendarDate, 'MMMM yyyy')}</h2>
                 <button onClick={() => setCalendarDate(addMonths(calendarDate, 1))} className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200 shadow-sm hover:shadow">
                   <ChevronRight size={20} className="text-slate-600" />
                 </button>
              </div>
              <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/50">
                 {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="py-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">{d}</div>
                 ))}
              </div>
              <div className="grid grid-cols-7 divide-x divide-slate-100 divide-y">
                 {calendarDays.map((day, idx) => {
                    const dayStr = format(day, 'yyyy-MM-dd');
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const isCurrentMonth = isSameMonth(day, calendarDate);
                    const isTodayDate = isToday(day);
                    const dayAppts = appointmentsByDate.get(dayStr) || [];
                    
                    return (
                       <div 
                         key={dayStr} 
                         onClick={() => setSelectedDate(day)}
                         className={`min-h-[100px] p-2 transition-all cursor-pointer hover:bg-slate-50 relative group ${
                           !isCurrentMonth ? 'bg-slate-50/30' : 'bg-white'
                         } ${isSelected ? 'ring-2 ring-inset ring-indigo-500 z-10' : ''}`}
                       >
                         <div className="flex items-center justify-between mb-2">
                            <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${
                               isTodayDate ? 'bg-indigo-600 text-white' : 
                               !isCurrentMonth ? 'text-slate-300' : 'text-slate-700'
                            }`}>
                               {format(day, 'd')}
                            </span>
                            {dayAppts.length > 0 && (
                               <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{dayAppts.length}</span>
                            )}
                         </div>
                         <div className="space-y-1">
                            {dayAppts.slice(0, 4).map(app => (
                               <div key={app.id} className="flex items-center gap-1.5" title={`${app.studentName} - ${app.status}`}>
                                  <div className={`w-2 h-2 rounded-full ${getStatusColor(app.status)} shrink-0`} />
                                  <span className="text-[10px] font-medium text-slate-600 truncate">{app.time}</span>
                               </div>
                            ))}
                            {dayAppts.length > 4 && (
                               <div className="text-[10px] text-slate-400 pl-1 font-medium">+ {dayAppts.length - 4} more</div>
                            )}
                         </div>
                       </div>
                    );
                 })}
              </div>
           </div>
           
           <div className="bg-slate-50 rounded-xl border-t-4 border-indigo-500 p-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                 {selectedDate ? `Appointments for ${format(selectedDate, 'MMM d, yyyy')}` : 'Select a date to view details'}
              </h3>
              {!selectedDate && (
                 <div className="text-center py-8 text-slate-400">
                    <CalendarIcon size={48} className="mx-auto mb-2 opacity-20" />
                    <p>Click on a calendar day to see specific appointments.</p>
                 </div>
              )}
           </div>
        </div>
      )}

      {transferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-xl p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Transfer Appointment</h3>
            <p className="text-sm text-slate-500 mb-4">Select a colleague to transfer this appointment to.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select Counselor</label>
                <select value={targetCounselorId} onChange={(e) => setTargetCounselorId(e.target.value)} disabled={isTransferring} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">-- Select --</option>
                  {counselors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={submitTransfer} disabled={!targetCounselorId || isTransferring} className="flex-1 flex items-center justify-center gap-2 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  {isTransferring ? <Loader2 size={16} className="animate-spin" /> : 'Send Request'}
                </button>
                <button onClick={() => setTransferModalOpen(false)} disabled={isTransferring} className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Appointment List (Used for both List View and Calendar Detail View) */}
      <div className="grid grid-cols-1 gap-4">
        {filteredAndSortedAppointments.length === 0 ? (
          (viewMode === 'list' || selectedDate) && (
            <div className="bg-white p-12 rounded-xl border border-dashed border-slate-300 text-center text-slate-500">
              <Search className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="font-medium text-slate-600">No appointments found.</p>
              {viewMode === 'calendar' && selectedDate && <p className="text-sm mt-1">No bookings for {format(selectedDate, 'MMM d, yyyy')}</p>}
            </div>
          )
        ) : (
          filteredAndSortedAppointments.map(app => (
            <div key={app.id} className={`rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow relative animate-in fade-in slide-in-from-bottom-2 ${app.transferRequestToId && String(app.transferRequestToId).toLowerCase() === String(user.id).toLowerCase() ? 'bg-purple-50 border-purple-200' : 'bg-white border-slate-200'}`}>
              {(app.transferRequestToId && String(app.transferRequestToId).toLowerCase() === String(user.id).toLowerCase()) && (
                <div className="bg-purple-600 text-white text-[10px] font-bold px-4 py-1.5 flex items-center justify-between uppercase tracking-widest">
                  <span className="flex items-center gap-1.5"><ArrowRightLeft size={12} /> Incoming Transfer</span>
                  <span className="opacity-80">From: {app.counselorName}</span>
                </div>
              )}
              {app.rescheduleProposedDate && !rescheduleId && (
                <div className="bg-amber-500 text-white text-[10px] font-bold px-4 py-1.5 flex items-center justify-between uppercase tracking-widest">
                  <span className="flex items-center gap-1.5"><RefreshCw size={12} /> Reschedule Requested</span>
                  <span className="opacity-80">Awaiting student's decision</span>
                </div>
              )}
              <div className="p-6">
                <div className="flex flex-col md:flex-row gap-6">
                  <div className={`w-1.5 self-stretch rounded-full ${getStatusColor(app.status)}`} />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-xl font-bold text-slate-900">{app.studentName || 'Unknown Student'}</h3>
                          {app.section && <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">{app.section}</span>}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                           {app.studentIdNumber && <span className="flex items-center gap-1"><Hash size={14} /> ID: {app.studentIdNumber}</span>}
                           {app.parentPhoneNumber && <span className="flex items-center gap-1"><Phone size={14} /> Parent: {app.parentPhoneNumber}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm ${
                          app.status === AppointmentStatus.PENDING ? 'bg-amber-100 text-amber-800 border border-amber-200' : 
                          app.status === AppointmentStatus.CONFIRMED ? 'bg-blue-100 text-blue-800 border border-blue-200' : 
                          app.status === AppointmentStatus.COMPLETED ? 'bg-green-100 text-green-800 border border-green-200' : 
                          app.status === AppointmentStatus.CANCELLED ? 'bg-red-100 text-red-800 border border-red-200' : 
                          app.status === AppointmentStatus.DEPARTED ? 'bg-cyan-100 text-cyan-800 border border-cyan-200 animate-pulse' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {app.status === AppointmentStatus.DEPARTED && <Footprints size={12} />}
                          {app.status === AppointmentStatus.DEPARTED ? 'INCOMING' : app.status}
                        </span>
                      </div>
                    </div>
                    
                    {rescheduleId === app.id ? (
                      <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 mb-4 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center justify-between mb-4">
                           <h4 className="font-bold text-indigo-900 flex items-center gap-2"><RefreshCw size={18} /> Propose New Time</h4>
                           <button onClick={() => setRescheduleId(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                        </div>
                        
                        <div className="flex flex-col lg:flex-row gap-6">
                           <div className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                              <div className="flex items-center justify-between mb-4">
                                <button onClick={() => setRescheduleCalendarMonth(addMonths(rescheduleCalendarMonth, -1))} className="p-1.5 hover:bg-slate-100 rounded-lg"><ChevronLeft size={18} /></button>
                                <span className="font-bold text-slate-800 text-sm">{format(rescheduleCalendarMonth, 'MMMM yyyy')}</span>
                                <button onClick={() => setRescheduleCalendarMonth(addMonths(rescheduleCalendarMonth, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg"><ChevronRight size={18} /></button>
                              </div>
                              <div className="grid grid-cols-7 gap-1 text-center mb-1">
                                {['S','M','T','W','T','F','S'].map(d => <div key={d} className="text-[10px] font-bold text-slate-400">{d}</div>)}
                              </div>
                              <div className="grid grid-cols-7 gap-1">
                                {Array.from({ length: startOfMonth(rescheduleCalendarMonth).getDay() }).map((_, i) => <div key={`empty-${i}`} />)}
                                {daysInRescheduleMonth.map(date => {
                                  const dateStr = format(date, 'yyyy-MM-dd');
                                  const status = getDateStatus(dateStr);
                                  const isSelected = rescheduleDate === dateStr;
                                  const isPast = date < new Date(new Date().setHours(0,0,0,0));
                                  return (
                                    <button
                                      key={dateStr}
                                      disabled={status === 'empty' || isPast}
                                      onClick={() => { setRescheduleDate(dateStr); setRescheduleTime(''); }}
                                      className={`h-9 rounded-lg text-xs font-semibold transition-all relative ${
                                        isSelected ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-200' :
                                        status === 'available' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' :
                                        status === 'fully-booked' ? 'bg-red-50 text-red-400 cursor-not-allowed' :
                                        'text-slate-300'
                                      }`}
                                    >
                                      {format(date, 'd')}
                                    </button>
                                  );
                                })}
                              </div>
                           </div>

                           <div className="flex-1 space-y-4">
                              {rescheduleDate ? (
                                <div>
                                   <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">Available Slots for {format(parseISO(rescheduleDate), 'MMM d')}</p>
                                   <div className="grid grid-cols-2 gap-2">
                                      {getSlotsForDate(rescheduleDate).map(slot => (
                                        <button
                                          key={slot.time}
                                          onClick={() => setRescheduleTime(slot.time)}
                                          className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                                            rescheduleTime === slot.time ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-[1.02]' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'
                                          }`}
                                        >
                                          {slot.time}
                                        </button>
                                      ))}
                                      {getSlotsForDate(rescheduleDate).length === 0 && (
                                        <div className="col-span-2 p-4 bg-red-50 text-red-600 text-center rounded-lg text-xs font-medium">No free slots available.</div>
                                      )}
                                   </div>
                                </div>
                              ) : (
                                <div className="h-full flex flex-col items-center justify-center p-6 bg-indigo-50/50 rounded-xl border border-dashed border-indigo-200 text-indigo-400">
                                   <CalendarDays size={32} className="mb-2 opacity-50" />
                                   <p className="text-xs font-bold uppercase tracking-wider text-center leading-tight">Pick a date from<br/>the calendar</p>
                                </div>
                              )}

                              <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-indigo-100">
                                <button 
                                  onClick={handleRescheduleConfirm}
                                  disabled={!rescheduleDate || !rescheduleTime || isRescheduling}
                                  className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                  {isRescheduling ? <Loader2 size={16} className="animate-spin" /> : 'Propose Reschedule'}
                                </button>
                                <button onClick={() => setRescheduleId(null)} className="w-full py-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold text-sm hover:bg-slate-50">Discard Changes</button>
                              </div>
                           </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-slate-700">
                              <CalendarDays size={16} className="text-indigo-500" />
                              <span className="font-semibold text-sm">{app.date ? format(parseISO(app.date), 'EEEE, MMMM do') : 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-700">
                              <Clock size={16} className="text-indigo-500" />
                              <span className="font-semibold text-sm">{app.time || 'N/A'}</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-start gap-2 text-slate-700">
                              <BookOpen size={16} className="text-indigo-500 mt-0.5" />
                              <div>
                                <span className="font-bold text-sm">{app.reason}</span>
                                <p className="text-xs text-slate-600 mt-1 italic line-clamp-2">"{app.description || 'No description'}"</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        {app.rescheduleProposedDate && (
                          <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                             <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase">
                                <RefreshCw size={14} className="animate-spin-slow" />
                                Proposed: {format(parseISO(app.rescheduleProposedDate), 'MMM d')} at {app.rescheduleProposedTime}
                             </div>
                             <button 
                               onClick={() => handleCancelReschedule(app.id)}
                               className="text-[10px] font-bold text-red-500 hover:text-red-700 flex items-center gap-1 uppercase tracking-tighter"
                             >
                               <Ban size={12} /> Retract
                             </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-row md:flex-col gap-2 md:w-40 md:border-l md:border-slate-100 md:pl-6 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100">
                    {app.transferRequestToId && String(app.transferRequestToId).toLowerCase() === String(user.id).toLowerCase() ? (
                      <>
                        <button onClick={() => respondToTransfer(app.id, true, user.id, user.name)} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 shadow-sm transition-colors"><UserCheck size={16} /> Accept</button>
                        <button onClick={() => respondToTransfer(app.id, false, user.id, user.name)} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-purple-200 text-purple-700 text-xs font-bold rounded-lg hover:bg-purple-50 transition-colors"><XCircle size={16} /> Decline</button>
                      </>
                    ) : !rescheduleId && (
                      <>
                        {(app.status === AppointmentStatus.PENDING || app.status === AppointmentStatus.DEPARTED) && (
                           <>
                             <button onClick={() => handleStatusChange(app.id, AppointmentStatus.CONFIRMED)} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 shadow-sm transition-colors"><CheckCircle size={16} /> {app.status === AppointmentStatus.DEPARTED ? 'Arrived' : 'Confirm'}</button>
                             {app.status === AppointmentStatus.PENDING && <button onClick={() => handleStatusChange(app.id, AppointmentStatus.CANCELLED)} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors"><XCircle size={16} /> Cancel</button>}
                           </>
                        )}
                        {app.status === AppointmentStatus.CONFIRMED && (
                           <>
                             <button onClick={() => handleStatusChange(app.id, AppointmentStatus.COMPLETED)} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 shadow-sm transition-colors"><CheckCircle size={16} /> Complete</button>
                           </>
                        )}
                        
                        {(app.status === AppointmentStatus.PENDING || app.status === AppointmentStatus.CONFIRMED) && !app.transferRequestToId && !app.rescheduleProposedDate && (
                           <>
                             <button onClick={() => { setRescheduleId(app.id); setRescheduleDate(''); setRescheduleTime(''); }} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-200 text-indigo-600 text-xs font-bold rounded-lg hover:bg-indigo-50 transition-colors"><RefreshCw size={16} /> Reschedule</button>
                             <button onClick={() => openTransferModal(app.id)} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50 hover:text-purple-600 transition-colors"><ArrowRightLeft size={16} /> Transfer</button>
                           </>
                        )}
                        {app.transferRequestToId && String(app.counselorId).toLowerCase() === String(user.id).toLowerCase() && (
                           <button onClick={() => handleCancelTransfer(app.id)} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold rounded-lg hover:bg-amber-100 transition-colors"><X size={16} /> Revoke Transfer</button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CounselorDashboard;
