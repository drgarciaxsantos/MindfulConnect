
import React from 'react';
import { Appointment, AppointmentStatus } from '../../types';
import { ShieldCheck, CheckCircle, XCircle, Clock, User, AlertCircle } from 'lucide-react';
import { updateAppointmentStatus } from '../../services/storageService';

interface VerificationModalProps {
  appointment: Appointment;
  onClose: () => void;
}

const VerificationModal: React.FC<VerificationModalProps> = ({ appointment, onClose }) => {
  const handleDecision = async (status: AppointmentStatus) => {
    await updateAppointmentStatus(appointment.id, status);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="bg-indigo-600 p-8 text-center text-white">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
            <ShieldCheck size={40} strokeWidth={2.5} />
          </div>
          <h2 className="text-3xl font-black tracking-tight mb-2 uppercase">Gate Entry Request</h2>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-xs font-bold tracking-widest uppercase">
            <AlertCircle size={14} /> Action Required
          </div>
        </div>

        <div className="p-10 space-y-8">
          <div className="flex items-center gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100">
            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
              <User size={32} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1">Student At Gate</p>
              <h3 className="text-2xl font-bold text-slate-900 truncate leading-tight">{appointment.studentName}</h3>
              <p className="text-slate-500 text-sm font-medium">{appointment.section}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Time Slot</p>
                <div className="flex items-center gap-2 text-slate-700">
                  <Clock size={16} className="text-indigo-500" />
                  <span className="font-bold">{appointment.time}</span>
                </div>
             </div>
             <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Reason</p>
                <div className="text-slate-700 font-bold truncate">{appointment.reason}</div>
             </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleDecision(AppointmentStatus.ACCEPTED)}
              className="w-full flex items-center justify-center gap-3 py-5 bg-emerald-600 text-white rounded-3xl font-black text-lg shadow-xl shadow-emerald-200 hover:bg-emerald-700 active:scale-[0.98] transition-all"
            >
              <CheckCircle size={24} /> ALLOW ENTRY
            </button>
            <button
              onClick={() => handleDecision(AppointmentStatus.DENIED)}
              className="w-full flex items-center justify-center gap-3 py-4 bg-white border-2 border-red-100 text-red-600 rounded-3xl font-bold hover:bg-red-50 active:scale-[0.98] transition-all"
            >
              <XCircle size={20} /> DENY ACCESS
            </button>
          </div>

          <p className="text-center text-slate-400 text-xs font-medium italic">
            Request triggered by Teacher/Guard at Gate.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerificationModal;
