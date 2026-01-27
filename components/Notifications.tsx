
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { X, CheckCircle, AlertCircle, Info, ShieldCheck, UserCheck, XCircle } from 'lucide-react';
import { SystemNotification, User, Appointment, AppointmentStatus } from '../types';
import { getSystemNotifications, markNotificationRead, markAllNotificationsRead, findVerificationCandidate, updateAppointmentStatus } from '../services/storageService';
import { supabase } from '../services/supabaseClient';

export type NotificationType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: NotificationType;
}

interface NotificationContextType {
  showNotification: (message: string, type: NotificationType) => void;
  notifications: SystemNotification[];
  unreadCount: number;
  refreshNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification must be used within a NotificationProvider');
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Toast notifications (UI alerts)
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // System notifications (from database)
  const [user, setInternalUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const isFetching = useRef(false);

  // Gatekeeper Verification State
  const [verificationRequest, setVerificationRequest] = useState<Appointment | null>(null);

  const setUser = useCallback((newUser: User | null) => {
    setInternalUser(newUser);
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!user || isFetching.current) return;
    isFetching.current = true;
    try {
      const data = await getSystemNotifications(user.id);
      setNotifications(data);
    } catch (err) {
      console.error("Failed to fetch system notifications", err);
    } finally {
      isFetching.current = false;
    }
  }, [user]);

  const markAsRead = useCallback(async (id: string) => {
    // Optimistic UI update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    await markNotificationRead(id);
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    // Optimistic UI update
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    await markAllNotificationsRead(user.id);
    showNotification('All notifications marked as read', 'success');
  }, [user]);

  const showNotification = useCallback((message: string, type: NotificationType) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleVerificationDecision = async (accepted: boolean) => {
    if (!verificationRequest) return;
    
    // Optimistically close modal
    const apptId = verificationRequest.id;
    setVerificationRequest(null);
    
    if (accepted) {
      await updateAppointmentStatus(apptId, AppointmentStatus.ACCEPTED);
      showNotification('Student Entry APPROVED', 'success');
    } else {
      await updateAppointmentStatus(apptId, AppointmentStatus.DENIED);
      showNotification('Student Entry DENIED', 'info');
    }
  };

  // Setup real-time listener and initial fetch
  useEffect(() => {
    if (user) {
      refreshNotifications();

      const channel = supabase
        .channel(`global_notifs_${user.id}`)
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          }, 
          async (payload) => {
             refreshNotifications();
             
             // High Priority Verification Check
             const newNotif = payload.new as SystemNotification;
             if (newNotif.message && newNotif.message.includes('VERIFICATION REQUEST')) {
                const pendingAppt = await findVerificationCandidate(user.id, newNotif.message);
                if (pendingAppt) {
                  setVerificationRequest(pendingAppt);
                  // Play alert sound if possible, or just rely on the modal
                }
             }
          }
        )
        .subscribe();

      // Poll as fallback every 60s
      const poll = setInterval(refreshNotifications, 60000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(poll);
      };
    } else {
      setNotifications([]);
      setVerificationRequest(null);
    }
  }, [user, refreshNotifications]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <NotificationContext.Provider value={{ 
      showNotification, 
      notifications, 
      unreadCount, 
      refreshNotifications, 
      markAsRead, 
      markAllAsRead,
      setUser
    }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white transition-all animate-in slide-in-from-right-5 fade-in duration-300 ${
              t.type === 'success' ? 'bg-emerald-600' :
              t.type === 'error' ? 'bg-red-600' :
              'bg-blue-600'
            }`}
          >
            {t.type === 'success' && <CheckCircle size={18} />}
            {t.type === 'error' && <AlertCircle size={18} />}
            {t.type === 'info' && <Info size={18} />}
            <span className="text-sm font-medium">{t.message}</span>
            <button onClick={() => removeToast(t.id)} className="ml-2 hover:bg-white/20 rounded p-0.5 transition-colors">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Gatekeeper Verification Modal */}
      {verificationRequest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="bg-indigo-600 p-6 text-white text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
              <ShieldCheck className="mx-auto mb-3" size={48} strokeWidth={1.5} />
              <h2 className="text-2xl font-bold tracking-tight">Verification Request</h2>
              <p className="text-indigo-100 mt-1 text-sm font-medium">A student is requesting entry at the gate.</p>
            </div>
            
            <div className="p-6">
              <div className="flex flex-col items-center gap-2 mb-8">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-2xl mb-1 shadow-inner border border-slate-200">
                  👋
                </div>
                <h3 className="text-xl font-bold text-slate-900">{verificationRequest.studentName}</h3>
                <div className="flex gap-2">
                   <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded uppercase tracking-wide">
                     {verificationRequest.section || 'N/A'}
                   </span>
                   {verificationRequest.studentIdNumber && (
                     <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded uppercase tracking-wide">
                       ID: {verificationRequest.studentIdNumber}
                     </span>
                   )}
                </div>
                <div className="mt-2 text-center">
                  <p className="text-sm text-slate-500 font-medium">Appointment Details</p>
                  <p className="text-slate-900 font-semibold">{verificationRequest.time} • {verificationRequest.reason}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => handleVerificationDecision(false)}
                  className="flex items-center justify-center gap-2 py-4 bg-red-50 border border-red-100 text-red-700 rounded-xl font-bold hover:bg-red-100 transition-colors active:scale-[0.98]"
                >
                  <XCircle size={20} /> Deny Entry
                </button>
                <button 
                  onClick={() => handleVerificationDecision(true)}
                  className="flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-colors active:scale-[0.98]"
                >
                  <UserCheck size={20} /> Allow Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};