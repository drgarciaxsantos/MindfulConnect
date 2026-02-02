
import React, { useState, useEffect, useMemo } from 'react';
import { User, Appointment, AppointmentStatus, DayAvailability } from '../../types';
import { getAppointments, updateAppointmentStatus, rescheduleAppointment, cancelRescheduleProposal, getCounselorAvailability, subscribeToAppointments, getCounselors, initiateTransfer, respondToTransfer, cancelTransfer } from '../../services/storageService';
import { Clock, CheckCircle, XCircle, Phone, Hash, BookOpen, CalendarDays, RefreshCw, ArrowRightLeft, UserCheck, Loader2, X, Search, SortAsc, SortDesc, ChevronLeft, ChevronRight, Ban } from 'lucide-react';
import AvailabilityManager from './AvailabilityManager';
import VerificationModal from './VerificationModal';
import { format, endOfMonth, eachDayOfInterval, addMonths } from 'date-fns';
import { useNotification } from '../Notifications';

const parseISO = (str: string) => new Date(str.includes('T') ? str : str + 'T00:00:00');
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

interface CounselorDashboardProps {
  user: User;
  activeTab: string;
}

type SortField = 'date' | 'name' | 'status';
type SortOrder = 'asc' | 'desc';

const CounselorDashboard: React.FC<CounselorDashboardProps> = ({ user, activeTab }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [counselors, setCounselors] = useState<User[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [isLoading, setIsLoading] = useState(true);
  const { showNotification } = useNotification();
  
  // Real-time Verification Pop-up State
  const [verifyingAppointment, setVerifyingAppointment] = useState<Appointment | null>(null);

  useEffect(() => {
    loadInitialData();
    const unsubscribe = subscribeToAppointments(() => {
      refreshAppointments();
    });
    return () => unsubscribe();
  }, [user.id]);

  const loadInitialData = async () => {
    setIsLoading(true);
    await Promise.all([loadAppointments(), loadCounselors()]);
    setIsLoading(false);
  };

  const loadCounselors = async () => {
    const list = await getCounselors();
    setCounselors(list.filter(c => String(c.id).toLowerCase() !== String(user.id).toLowerCase()));
  };

  const loadAppointments = async () => {
    try {
      const all = await getAppointments();
      const currentUserId = String(user.id).toLowerCase();
      const mine = all.filter(a => String(a.counselorId).toLowerCase() === currentUserId || (a.transferRequestToId && String(a.transferRequestToId).toLowerCase() === currentUserId));
      setAppointments(mine);
      checkGateRequests(mine);
    } catch (e) {
      console.error("Failed to load appointments", e);
    }
  };

  const refreshAppointments = async () => {
    const all = await getAppointments();
    const currentUserId = String(user.id).toLowerCase();
    const mine = all.filter(a => String(a.counselorId).toLowerCase() === currentUserId || (a.transferRequestToId && String(a.transferRequestToId).toLowerCase() === currentUserId));
    setAppointments(mine);
    checkGateRequests(mine);
  };

  const checkGateRequests = (list: Appointment[]) => {
    const waiting = list.find(a => a.isAtGate);
    if (waiting) setVerifyingAppointment(waiting);
    else setVerifyingAppointment(null);
  };

  const handleStatusChange = async (id: string, status: AppointmentStatus) => {
    await updateAppointmentStatus(id, status);
    showNotification(`Appointment updated to ${status.toLowerCase()}`, 'success');
    refreshAppointments();
  };

  const filteredAndSortedAppointments = useMemo(() => {
    let result = appointments.filter(a => {
      const matchesFilter = filter === 'all' || a.status === filter;
      const query = searchQuery.toLowerCase();
      const matchesSearch = (a.studentName || '').toLowerCase().includes(query) || (a.studentIdNumber || '').toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });

    result.sort((a, b) => {
      let comp = 0;
      if (sortBy === 'date') comp = new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime();
      else if (sortBy === 'name') comp = (a.studentName || '').localeCompare(b.studentName || '');
      else if (sortBy === 'status') comp = (a.status || '').localeCompare(b.status || '');
      return sortOrder === 'asc' ? comp : -comp;
    });
    return result;
  }, [appointments, filter, searchQuery, sortBy, sortOrder]);

  if (activeTab === 'availability') return <AvailabilityManager user={user} />;

  return (
    <div className="space-y-6">
      {verifyingAppointment && (
        <VerificationModal 
          appointment={verifyingAppointment} 
          onClose={() => setVerifyingAppointment(null)} 
        />
      )}

      <header className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
          Counseling Schedule
          {isLoading && <Loader2 className="animate-spin text-indigo-500" size={20} />}
        </h2>
        
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto">
              {['all', AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED].map(f => (
                <button 
                  key={f} 
                  onClick={() => setFilter(f)} 
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border shrink-0 transition-all ${
                    filter === f ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {filteredAndSortedAppointments.map(app => (
          <div key={app.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col md:flex-row gap-6 relative overflow-hidden">
            {app.isAtGate && <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-black px-3 py-1 uppercase tracking-widest animate-pulse">At Gate</div>}
            <div className={`w-1.5 self-stretch rounded-full ${
              app.status === AppointmentStatus.PENDING ? 'bg-amber-400' : 
              app.status === AppointmentStatus.CONFIRMED ? 'bg-blue-500' : 
              app.status === AppointmentStatus.COMPLETED ? 'bg-green-500' : 
              'bg-slate-200'
            }`} />
            <div className="flex-1">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-xl font-bold text-slate-900">{app.studentName}</h3>
                <span className="text-xs font-bold text-slate-400">{app.status}</span>
              </div>
              <p className="text-sm text-slate-500 mb-4">{app.section} • {app.time} • {format(parseISO(app.date), 'MMM d')}</p>
              <div className="flex gap-2">
                {app.status === AppointmentStatus.PENDING && (
                  <button onClick={() => handleStatusChange(app.id, AppointmentStatus.CONFIRMED)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold">Confirm</button>
                )}
                {app.status === AppointmentStatus.CONFIRMED && (
                  <button onClick={() => handleStatusChange(app.id, AppointmentStatus.COMPLETED)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold">Mark Completed</button>
                )}
                <button onClick={() => handleStatusChange(app.id, AppointmentStatus.CANCELLED)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold">Cancel</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CounselorDashboard;
