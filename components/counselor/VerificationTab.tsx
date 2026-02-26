import React, { useState, useEffect } from 'react';
import { User, Appointment, AppointmentStatus } from '../../types';
import { getAppointments, updateAppointmentStatus } from '../../services/storageService';
import { ShieldCheck, CheckCircle, XCircle, Clock, MapPin, User as UserIcon, RefreshCw, CalendarCheck } from 'lucide-react';
import { format } from 'date-fns';
import { useNotification } from '../Notifications';

interface VerificationTabProps {
  user: User;
}

const VerificationTab: React.FC<VerificationTabProps> = ({ user }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const { showNotification } = useNotification();
  const [activeFilter, setActiveFilter] = useState<'today' | 'history'>('today');

  const loadData = async () => {
    setLoading(true);
    try {
      const all = await getAppointments();
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      
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
    const interval = setInterval(loadData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [user.id]);

  const handleDecision = async (appt: Appointment, status: AppointmentStatus) => {
    await updateAppointmentStatus(appt.id, status);
    
    let message = 'Status Updated';
    let type: 'success' | 'info' = 'info';

    if (status === AppointmentStatus.COMPLETED) {
      message = 'Appointment Completed';
      type = 'success';
    } else if (status === AppointmentStatus.CANCELLED) {
      message = 'Appointment Cancelled';
      type = 'info';
    }

    showNotification(message, type);
    loadData();
  };

  // Today's Confirmed Appointments
  const todayList = appointments.filter(a => a.status === AppointmentStatus.CONFIRMED);
  
  // History items - includes CANCELLED and COMPLETED. 
  const historyList = appointments.filter(a => 
    a.status === AppointmentStatus.COMPLETED || 
    a.status === AppointmentStatus.CANCELLED
  );

  const displayList = activeFilter === 'today' ? todayList : historyList;

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="text-indigo-600" /> Daily Overview
          </h2>
          <p className="text-slate-500">Manage today's appointments and track completions.</p>
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
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-indigo-600 font-bold text-xs uppercase tracking-wider mb-1">Today's Appointments</p>
          <p className="text-3xl font-bold text-slate-800">{todayList.length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-emerald-600 font-bold text-xs uppercase tracking-wider mb-1">Completed Today</p>
          <p className="text-3xl font-bold text-slate-800">{appointments.filter(a => a.status === AppointmentStatus.COMPLETED).length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-1">Total Scheduled</p>
          <p className="text-3xl font-bold text-slate-800">{appointments.length}</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveFilter('today')}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeFilter === 'today' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Today's Schedule
          {todayList.length > 0 && (
             <span className="bg-indigo-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{todayList.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveFilter('history')}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
            activeFilter === 'history' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          History
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {displayList.length === 0 ? (
           <div className="py-16 text-center bg-white rounded-xl border border-dashed border-slate-300">
             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
               <CalendarCheck size={32} />
             </div>
             <p className="text-slate-500 font-medium">No {activeFilter === 'today' ? 'appointments scheduled for today' : 'history records'} found.</p>
           </div>
        ) : (
          displayList.map(appt => (
            <div key={appt.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row transition-all">
              <div className={`w-full md:w-2 ${
                appt.status === AppointmentStatus.CONFIRMED ? 'bg-blue-500' :
                appt.status === AppointmentStatus.COMPLETED ? 'bg-emerald-500' :
                appt.status === AppointmentStatus.CANCELLED ? 'bg-red-500' :
                'bg-slate-300'
              }`} />
              
              <div className="p-6 flex-1 flex flex-col justify-center relative">
                {activeFilter === 'today' && (
                  <button
                    onClick={() => handleDecision(appt, AppointmentStatus.CANCELLED)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition-colors"
                    title="Cancel Appointment"
                  >
                    <XCircle size={24} />
                  </button>
                )}
                <div className="flex justify-between items-start mb-2 pr-8">
                  <h3 className="text-xl font-bold text-slate-900">{appt.studentName}</h3>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                    appt.status === AppointmentStatus.CONFIRMED ? 'bg-blue-100 text-blue-800' :
                    appt.status === AppointmentStatus.COMPLETED ? 'bg-emerald-100 text-emerald-800' :
                    appt.status === AppointmentStatus.CANCELLED ? 'bg-red-100 text-red-800' :
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

              {activeFilter === 'today' && (
                <div className="p-4 md:p-6 bg-slate-50 flex flex-col gap-2 justify-center md:border-l border-slate-100 md:w-48">
                  <button
                    onClick={() => handleDecision(appt, AppointmentStatus.COMPLETED)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-3 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                  >
                    <CheckCircle size={16} /> Complete
                  </button>
                  <button
                    onClick={() => handleDecision(appt, AppointmentStatus.CANCELLED)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-3 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors"
                  >
                    <XCircle size={16} /> Cancel
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