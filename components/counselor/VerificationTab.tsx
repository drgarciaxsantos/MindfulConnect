
import React, { useState, useEffect } from 'react';
import { User, Appointment, AppointmentStatus } from '../../types';
import { getAppointments, updateAppointmentStatus, subscribeToAppointments } from '../../services/storageService';
import { ShieldCheck, RefreshCw, Filter, Clock, MapPin, User as UserIcon } from 'lucide-react';
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
  const [activeFilter, setActiveFilter] = useState<'pending' | 'history'>('pending');
  const [verifyingAppointment, setVerifyingAppointment] = useState<Appointment | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const all = await getAppointments();
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const mine = all.filter(a => String(a.counselorId).toLowerCase() === String(user.id).toLowerCase() && a.date === todayStr);
      setAppointments(mine);
      
      const waiting = mine.find(a => a.isAtGate);
      setVerifyingAppointment(waiting || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToAppointments(loadData);
    return () => unsubscribe();
  }, [user.id]);

  const handleDecision = async (id: string, status: AppointmentStatus) => {
    await updateAppointmentStatus(id, status);
    showNotification(status === AppointmentStatus.ACCEPTED ? 'Approved' : 'Denied', 'info');
    loadData();
  };

  const gateRequests = appointments.filter(a => a.isAtGate);
  const history = appointments.filter(a => [AppointmentStatus.ACCEPTED, AppointmentStatus.DENIED].includes(a.status));
  const displayList = activeFilter === 'pending' ? gateRequests : history;

  return (
    <div className="space-y-6">
      {verifyingAppointment && (
        <VerificationModal 
          appointment={verifyingAppointment} 
          onClose={() => setVerifyingAppointment(null)} 
        />
      )}

      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="text-indigo-600" /> Gate Access Control
          </h2>
          <p className="text-slate-500">Today's students requesting entry.</p>
        </div>
        <button onClick={loadData} className="p-2 hover:bg-slate-100 rounded-lg"><RefreshCw size={20} className={loading ? "animate-spin" : ""} /></button>
      </header>

      <div className="flex gap-2 border-b border-slate-200">
        <button onClick={() => setActiveFilter('pending')} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeFilter === 'pending' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}>Gate Requests ({gateRequests.length})</button>
        <button onClick={() => setActiveFilter('history')} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeFilter === 'history' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}>History</button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {displayList.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-xl border border-dashed border-slate-300">
             <Filter size={32} className="mx-auto text-slate-300 mb-2" />
             <p className="text-slate-500 font-medium">No requests to show.</p>
          </div>
        ) : (
          displayList.map(appt => (
            <div key={appt.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{appt.studentName}</h3>
                <p className="text-sm text-slate-500">{appt.time} • {appt.section}</p>
              </div>
              {activeFilter === 'pending' ? (
                <div className="flex gap-2">
                  <button onClick={() => handleDecision(appt.id, AppointmentStatus.ACCEPTED)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold">Allow</button>
                  <button onClick={() => handleDecision(appt.id, AppointmentStatus.DENIED)} className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-bold">Deny</button>
                </div>
              ) : (
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${appt.status === AppointmentStatus.ACCEPTED ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {appt.status}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default VerificationTab;
