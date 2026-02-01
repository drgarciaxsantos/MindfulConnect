import React, { useState, useEffect } from 'react';
import { User, Appointment, AppointmentStatus } from '../../types';
import { getAppointments, updateAppointmentStatus } from '../../services/storageService';
import { ShieldCheck, CheckCircle, XCircle, Clock, MapPin, User as UserIcon, RefreshCw, Filter } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { useNotification } from '../Notifications';

interface VerificationTabProps {
  user: User;
}

const VerificationTab: React.FC<VerificationTabProps> = ({ user }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const { showNotification } = useNotification();
  const [activeFilter, setActiveFilter] = useState<'pending' | 'processed'>('pending');

  const loadData = async () => {
    setLoading(true);
    try {
      const all = await getAppointments();
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      
      // Filter for:
      // 1. Belongs to this counselor
      // 2. Is for TODAY
      const todaysAppointments = all.filter(a => {
        const isOwner = String(a.counselorId).toLowerCase() === String(user.id).toLowerCase();
        const isToday = a.date === todayStr;
        return isOwner && isToday;
      });

      setAppointments(todaysAppointments);
    } catch (e) {
      console.error("Failed to load appointments", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [user.id]);

  const handleDecision = async (appt: Appointment, status: AppointmentStatus) => {
    await updateAppointmentStatus(appt.id, status);
    showNotification(
      status === AppointmentStatus.ACCEPTED ? 'Entry Approved' : 'Entry Denied', 
      status === AppointmentStatus.ACCEPTED ? 'success' : 'info'
    );
    loadData();
  };

  // Actionable items: PENDING (New requests) or CONFIRMED (Scheduled but waiting at gate)
  const pendingList = appointments.filter(a => 
    a.status === AppointmentStatus.PENDING || 
    a.status === AppointmentStatus.CONFIRMED
  );

  // History items
  const processedList = appointments.filter(a => 
    a.status === AppointmentStatus.ACCEPTED || 
    a.status === AppointmentStatus.DENIED ||
    a.status === AppointmentStatus.COMPLETED ||
    a.status === AppointmentStatus.CANCELLED
  );

  const displayList = activeFilter === 'pending' ? pendingList : processedList;

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="text-indigo-600" /> Gate Access Control
          </h2>
          <p className="text-slate-500">Manage student entry requests for today's appointments.</p>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={loadData}
             className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
             title="Refresh Data"
           >
             <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
           </button>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-amber-50 to-white p-6 rounded-xl border border-amber-100 shadow-sm">
          <p className="text-amber-600 font-bold text-xs uppercase tracking-wider mb-1">Awaiting Entry</p>
          <p className="text-3xl font-bold text-slate-800">{pendingList.length}</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-white p-6 rounded-xl border border-emerald-100 shadow-sm">
          <p className="text-emerald-600 font-bold text-xs uppercase tracking-wider mb-1">Approved Today</p>
          <p className="text-3xl font-bold text-slate-800">{appointments.filter(a => a.status === AppointmentStatus.ACCEPTED).length}</p>
        </div>
        <div className="bg-gradient-to-br from-slate-50 to-white p-6 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-1">Total Scheduled</p>
          <p className="text-3xl font-bold text-slate-800">{appointments.length}</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveFilter('pending')}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
            activeFilter === 'pending' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Action Required ({pendingList.length})
        </button>
        <button
          onClick={() => setActiveFilter('processed')}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
            activeFilter === 'processed' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          History / Processed
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {displayList.length === 0 ? (
           <div className="py-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
               {activeFilter === 'pending' ? <ShieldCheck size={32} /> : <Filter size={32} />}
             </div>
             <p className="text-slate-500 font-medium">No items found.</p>
           </div>
        ) : (
          displayList.map(appt => (
            <div key={appt.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
              <div className={`w-full md:w-2 ${
                appt.status === AppointmentStatus.PENDING ? 'bg-amber-400' :
                appt.status === AppointmentStatus.CONFIRMED ? 'bg-blue-400' :
                appt.status === AppointmentStatus.ACCEPTED ? 'bg-emerald-500' :
                appt.status === AppointmentStatus.DENIED ? 'bg-red-500' :
                'bg-slate-300'
              }`} />
              
              <div className="p-6 flex-1 flex flex-col justify-center">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-bold text-slate-900">{appt.studentName}</h3>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                    appt.status === AppointmentStatus.PENDING ? 'bg-amber-100 text-amber-800' :
                    appt.status === AppointmentStatus.CONFIRMED ? 'bg-blue-100 text-blue-800' :
                    appt.status === AppointmentStatus.ACCEPTED ? 'bg-emerald-100 text-emerald-800' :
                    appt.status === AppointmentStatus.DENIED ? 'bg-red-100 text-red-800' :
                    'bg-slate-100 text-slate-800'
                  }`}>
                    {appt.status}
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500 mb-4">
                  <span className="flex items-center gap-1.5"><Clock size={16} className="text-indigo-500" /> {appt.time} Today</span>
                  <span className="flex items-center gap-1.5"><MapPin size={16} className="text-indigo-500" /> {appt.section || 'No Section'}</span>
                  {appt.studentIdNumber && <span className="flex items-center gap-1.5"><UserIcon size={16} className="text-indigo-500" /> ID: {appt.studentIdNumber}</span>}
                </div>
                
                <p className="text-slate-700 font-medium bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm">
                  Reason: {appt.reason}
                </p>
              </div>

              {activeFilter === 'pending' && (
                <div className="p-4 md:p-6 bg-slate-50 flex flex-row md:flex-col gap-3 justify-center md:border-l border-slate-100">
                  <button
                    onClick={() => handleDecision(appt, AppointmentStatus.ACCEPTED)}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all active:scale-95"
                  >
                    <CheckCircle size={18} /> Allow
                  </button>
                  <button
                    onClick={() => handleDecision(appt, AppointmentStatus.DENIED)}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-red-100 text-red-600 rounded-xl font-bold hover:bg-red-50 hover:border-red-200 transition-all active:scale-95"
                  >
                    <XCircle size={18} /> Deny
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default VerificationTab;