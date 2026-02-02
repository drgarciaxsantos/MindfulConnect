import React from 'react';
import { Appointment, AppointmentStatus } from '../../types';
import { ShieldCheck, CheckCircle, XCircle, Clock, User, AlertCircle, UserCheck } from 'lucide-react';
import { updateAppointmentStatus } from '../../services/storageService';

interface VerificationModalProps {
  appointment: Appointment;
  onClose: () => void;
}

const VerificationModal: React.FC<VerificationModalProps> = ({ appointment, onClose }) => {
  const handleDecision = async (status: AppointmentStatus) => {
    try {
      await updateAppointmentStatus(appointment.id, status);
      onClose();
    } catch (e) {
      console.error("Error updating status:", e);
    }
  };

  const isVerifying = appointment.status === AppointmentStatus.VERIFYING;
  const teacherName = appointment.verifiedByTeacherName;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 relative">
        <div className="bg-indigo-600 p-8 text-center text-white relative">
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-pulse" />
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md shadow-inner ring-4 ring-white/10">
            <ShieldCheck size={40} strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl font-black tracking-tight mb-2 uppercase drop-shadow-sm">Verification Request</h2>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-xs font-bold tracking-widest uppercase border border-white/20">
            <AlertCircle size={14} /> Action Required
          </div>
        </div>

        {(isVerifying || teacherName) && (
          <div className="bg-amber-50 px-8 py-5 border-b border-amber-100 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left animate-in slide-in-from-top-4 duration-500">
            <div className="p-3 bg-amber-100 text-amber-700 rounded-full shrink-0 shadow-sm">
              <UserCheck size={24} />
            </div>
            <div>
              <p className="text-amber-900 font-medium text-lg leading-snug">
                {teacherName ? (
                  <>
                    <span className="font-bold">{teacherName}</span> is requesting verification for <span className="font-bold">{appointment.studentName}</span>
                  </>
                ) : (
                  <>
                    Requesting entry for <span className="font-bold">{appointment.studentName}</span>
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        <div className="p-8 space-y-6">
          <div className="flex items-center gap-5 p-5 bg-slate-50 rounded-3xl border border-slate-100 shadow-sm">
            <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
              <User size={28} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-0.5">Student</p>
              <h3 className="text-xl font-bold text-slate-900 truncate leading-tight">{appointment.studentName}</h3>
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
             {teacherName && (
               <div className="col-span-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Verified By Teacher</p>
                  <div className="flex items-center gap-2 text-slate-700">
                    <UserCheck size={16} className="text-indigo-500" />
                    <span className="font-bold">{teacherName}</span>
                  </div>
               </div>
             )}
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <button
              onClick={() => handleDecision(AppointmentStatus.CONFIRMED)}
              className="w-full flex items-center justify-center gap-3 py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-200 hover:bg-emerald-700 active:scale-[0.98] transition-all"
            >
              <CheckCircle size={24} /> ACCEPT
            </button>
            <button
              onClick={() => handleDecision(AppointmentStatus.CANCELLED)}
              className="w-full flex items-center justify-center gap-3 py-3 bg-white border-2 border-red-100 text-red-600 rounded-2xl font-bold hover:bg-red-50 active:scale-[0.98] transition-all"
            >
              <XCircle size={20} /> DENY
            </button>
          </div>

          <p className="text-center text-slate-400 text-[10px] font-medium italic">
            Please verify the student's appointment details before accepting or denying.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerificationModal;