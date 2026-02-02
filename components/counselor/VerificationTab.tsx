
import React, { useState, useEffect } from 'react';
import { User, Appointment, AppointmentStatus } from '../../types';
import { getAppointments, updateAppointmentStatus } from '../../services/storageService';
import { ShieldCheck, CheckCircle, XCircle, Clock, MapPin, User as UserIcon, RefreshCw, AlertTriangle, Eye, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { useNotification } from '../Notifications';
import VerificationModal from './VerificationModal';

interface VerificationTabProps {
  user: User;
}

const VerificationTab: React.FC<VerificationTabProps> = ({ user }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const { showNotification } = useNotification();
  const [activeFilter, setActiveFilter] = useState<'requests' | 'history'>('requests');
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);

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
    showNotification(
      status === AppointmentStatus.ACCEPTED ? 'Entry Approved' : 'Entry Denied', 
      status === AppointmentStatus.ACCEPTED ? 'success' : 'info'
    );
    loadData();
  };

  // Filter for VERIFYING (At Gate) requests - High Priority
  const gateRequests = appointments.filter(a => a.status === AppointmentStatus.VERIFYING);
  
  // History items
  const historyList = appointments.filter(a => 
    a.status === AppointmentStatus.ACCEPTED || 
    a.status === AppointmentStatus.DENIED || 
    a.status === AppointmentStatus.COMPLETED ||
    a.status === AppointmentStatus.CANCELLED
  );

  const displayList = activeFilter === 'requests' ? gateRequests : historyList;

  return (
    <div className="space-y-6">
      {selectedAppt && (
        <VerificationModal 
          appointment={selectedAppt} 
          onClose={() => setSelectedAppt(null)} 
        />
      )}

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="text-indigo-600" /> Gate Requests
          </h2>
          <p className="text-slate-500">Monitor and approve students waiting at the gate.</p>
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
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 rounded-xl border border-indigo-700 shadow-md text-white">
          <div className="flex items-center gap-2 mb-1 text-indigo-200 text-xs font-bold uppercase tracking-wider">
            <AlertTriangle size={14} className="animate-pulse" />
            Waiting at Gate
          </div>
          <p className="text-4xl font-black">{gateRequests.length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-emerald-600 font-bold text-xs uppercase tracking-wider mb-1">Entries Approved</p>
          <p className="text-3xl font-bold text-slate-800">{appointments.filter(a => a.status === AppointmentStatus.ACCEPTED).length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-1">Total Scheduled</p>
          <p className="text-3xl font-bold text-slate-800">{appointments.length}</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveFilter('requests')}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeFilter === 'requests' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Active Requests
          {gateRequests.length > 0 && (
             <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{gateRequests.length}</span>
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
               <ShieldCheck size={32} />
             </div>
             <p className="text-slate-500 font-medium">No {activeFilter === 'requests' ? 'students waiting at the gate' : 'history records'} found.</p>
           </div>
        ) : (
          displayList.map(appt => (
            <div key={appt.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col md:flex-row transition-all ${appt.status === AppointmentStatus.VERIFYING ? 'border-indigo-200 shadow-md ring-1 ring-indigo-50' : 'border-slate-200'}`}>
              <div className={`w-full md:w-2 ${
                appt.status === AppointmentStatus.VERIFYING ? 'bg-indigo-600 animate-pulse' :
                appt.status === AppointmentStatus.ACCEPTED ? 'bg-emerald-500' :
                appt.status === AppointmentStatus.DENIED ? 'bg-red-500' :
                'bg-slate-300'
              }`} />
              
              <div className="p-6 flex-1 flex flex-col justify-center">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-bold text-slate-900">{appt.studentName}</h3>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                    appt.status === AppointmentStatus.VERIFYING ? 'bg-indigo-600 text-white' :
                    appt.status === AppointmentStatus.ACCEPTED ? 'bg-emerald-100 text-emerald-800' :
                    appt.status === AppointmentStatus.DENIED ? 'bg-red-100 text-red-800' :
                    'bg-slate-100 text-slate-800'
                  }`}>
                    {appt.status === AppointmentStatus.VERIFYING ? 'AT GATE' : appt.status}
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500 mb-4">
                  <span className="flex items-center gap-1.5"><Clock size={16} className="text-indigo-500" /> {appt.time} Today</span>
                  <span className="flex items-center gap-1.5"><MapPin size={16} className="text-indigo-500" /> {appt.section || 'No Section'}</span>
                  {appt.studentIdNumber && <span className="flex items-center gap-1.5"><UserIcon size={16} className="text-indigo-500" /> ID: {appt.studentIdNumber}</span>}
                </div>
                
                {appt.verifiedByTeacherName && (
                  <div className="mb-4 inline-flex items-center gap-2 bg-amber-50 text-amber-800 text-xs font-bold px-3 py-2 rounded-lg border border-amber-100">
                     <UserCheck size={14} />
                     Verified by: {appt.verifiedByTeacherName}
                  </div>
                )}
                
                <p className="text-slate-700 font-medium bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm">
                  Reason: {appt.reason}
                </p>
              </div>

              {activeFilter === 'requests' && (
                <div className="p-4 md:p-6 bg-slate-50 flex flex-col gap-2 justify-center md:border-l border-slate-100 md:w-48">
                  <button
                    onClick={() => setSelectedAppt(appt)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                    <Eye size={16} /> Review
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDecision(appt, AppointmentStatus.ACCEPTED)}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-200 transition-colors"
                      title="Quick Allow"
                    >
                      <CheckCircle size={16} /> Allow
                    </button>
                    <button
                      onClick={() => handleDecision(appt, AppointmentStatus.DENIED)}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:bg-red-200 transition-colors"
                      title="Quick Deny"
                    >
                      <XCircle size={16} /> Deny
                    </button>
                  </div>
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
