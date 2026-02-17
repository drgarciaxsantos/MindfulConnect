
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, Appointment, AppointmentStatus } from '../types';
import { LogOut, LayoutDashboard, Calendar, FileText, CalendarPlus, CalendarCheck, Bell, Check, ArrowRight, ShieldCheck, BrainCircuit } from 'lucide-react';
import { checkAndSendReminders, getAppointments } from '../services/storageService';
import { useNotification } from './Notifications';
import VerificationModal from './counselor/VerificationModal';
import { supabase } from '../services/supabaseClient';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, activeTab, onTabChange }) => {
  const { notifications, unreadCount, markAsRead, refreshNotifications } = useNotification();
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  
  // Realtime Gate Request State
  const [gateRequest, setGateRequest] = useState<Appointment | null>(null);

  useEffect(() => {
    if (user) {
      checkAndSendReminders(user.id);
    }
  }, [user?.id]);

  // Global listener for Gate Requests (VERIFYING status)
  useEffect(() => {
    if (user && user.role === UserRole.COUNSELOR) {
      // 1. Initial Check function
      const checkPendingGateRequests = async () => {
        try {
          const all = await getAppointments();
          // Look for VERIFYING requests assigned to this counselor
          const pending = all.find(a => 
            a.status === AppointmentStatus.VERIFYING && 
            String(a.counselorId).toLowerCase() === String(user.id).toLowerCase()
          );
          
          if (pending) {
            console.log("Found pending gate request:", pending);
            setGateRequest(pending);
          } else {
            setGateRequest(null);
          }
        } catch (err) {
          console.error("Error checking pending requests:", err);
        }
      };
      
      // Run initial check
      checkPendingGateRequests();

      // 2. Realtime Subscription
      // We listen to ALL appointments changes to be safe, then filter in JS
      const channel = supabase.channel('global_gate_watch')
        .on(
          'postgres_changes', 
          { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'appointments' 
          }, 
          (payload) => {
            const newRecord = payload.new as any;
            const myId = String(user.id).toLowerCase();
            const recordCounselorId = String(newRecord.counselor_id).toLowerCase();

            // Only care if it belongs to this counselor
            if (recordCounselorId === myId) {
               if (newRecord.status === AppointmentStatus.VERIFYING) {
                 // Trigger a full fetch to get fresh data
                 checkPendingGateRequests();
               } else if (
                 gateRequest && 
                 newRecord.id === gateRequest.id && 
                 newRecord.status !== AppointmentStatus.VERIFYING
               ) {
                 // If the current request was handled (confirmed/cancelled), close modal
                 setGateRequest(null);
               }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, gateRequest]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (id: string) => {
    await markAsRead(id);
  };

  const NotificationBell = ({ positionClasses = "right-0 mt-2" }: { positionClasses?: string }) => (
    <div className="relative" ref={notificationRef}>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          if (!showNotifications) {
            refreshNotifications();
          }
          setShowNotifications(!showNotifications);
        }}
        className="p-2.5 rounded-full hover:bg-slate-100 text-slate-600 transition-all relative border border-transparent hover:border-slate-200"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center px-1 border-2 border-white animate-in zoom-in-50">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showNotifications && (
        <div className={`absolute ${positionClasses} w-80 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200`}>
          <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-sm text-slate-700">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                {unreadCount} UNREAD
              </span>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-10 text-center text-slate-500 text-sm flex flex-col items-center gap-2">
                <Bell size={24} className="text-slate-200" />
                No notifications found.
              </div>
            ) : (
              notifications.slice(0, 10).map(n => (
                <div 
                  key={n.id} 
                  className={`p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors flex gap-3 group ${n.isRead ? 'opacity-60 bg-white' : 'bg-indigo-50/30'}`}
                >
                  <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 transition-colors ${n.isRead ? 'bg-slate-200' : 'bg-indigo-500'}`} />
                  <div className="flex-1">
                    <p className={`text-sm leading-snug ${n.isRead ? 'text-slate-600' : 'text-slate-900 font-semibold'}`}>{n.message}</p>
                    <p className="text-[10px] text-slate-400 mt-1.5 font-medium">{new Date(n.createdAt).toLocaleDateString()} • {new Date(n.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                  </div>
                  {!n.isRead && (
                    <button 
                      onClick={() => handleMarkRead(n.id)}
                      className="text-indigo-600 hover:text-indigo-800 self-start opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-indigo-100 rounded-lg"
                      title="Mark as read"
                    >
                      <Check size={14} strokeWidth={3} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="p-2 bg-slate-50 border-t border-slate-100">
            <button 
              onClick={() => {
                setShowNotifications(false);
                onTabChange?.('notifications');
              }}
              className="w-full flex items-center justify-center gap-1 text-xs font-bold text-indigo-600 hover:bg-indigo-100 py-2.5 rounded-lg transition-colors"
            >
              View all notifications <ArrowRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (!user) return <>{children}</>;

  if (user.role === UserRole.STUDENT) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col relative font-sans">
        <header className="bg-white border-b border-slate-200 px-5 py-3 sticky top-0 z-20 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white shadow-sm">
               <BrainCircuit size={20} />
            </div>
            <span className="font-bold text-slate-800 tracking-tight text-lg">MindfulConnect</span>
          </div>
          
          <div className="flex items-center gap-1">
            <NotificationBell positionClasses="right-0 mt-3 origin-top-right shadow-2xl" />
            <button
              onClick={onLogout}
              className="text-slate-400 hover:text-red-600 transition-colors p-2 rounded-full hover:bg-slate-50"
              title="Sign Out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <main className="flex-1 w-full max-w-lg mx-auto pb-safe">
          {children}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-2 z-30 flex justify-around items-center pb-safe safe-area-bottom shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
          <button
            onClick={() => onTabChange?.('book')}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all w-24 ${
              activeTab === 'book' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <div className={`p-1.5 rounded-full transition-all ${activeTab === 'book' ? 'bg-indigo-50 scale-110' : 'bg-transparent'}`}>
              <CalendarPlus size={24} strokeWidth={activeTab === 'book' ? 2.5 : 2} />
            </div>
            <span className="text-[10px] font-bold">Book</span>
          </button>

          <button
            onClick={() => onTabChange?.('my-appointments')}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all w-24 ${
              activeTab === 'my-appointments' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <div className={`p-1.5 rounded-full transition-all ${activeTab === 'my-appointments' ? 'bg-indigo-50 scale-110' : 'bg-transparent'}`}>
              <CalendarCheck size={24} strokeWidth={activeTab === 'my-appointments' ? 2.5 : 2} />
            </div>
            <span className="text-[10px] font-bold">History</span>
          </button>
        </nav>
      </div>
    );
  }

  // Counselor Layout
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 h-screen sticky top-0 z-30">
        <div className="p-6 border-b border-slate-100 flex items-center gap-2.5">
           <div className="bg-indigo-600 p-1.5 rounded-lg text-white shadow-sm">
             <BrainCircuit size={24} />
           </div>
          <span className="font-bold text-slate-800 tracking-tight text-xl">MindfulConnect</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => onTabChange?.('appointments')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'appointments' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button
            onClick={() => onTabChange?.('availability')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'availability' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Calendar size={20} /> Availability
          </button>
          <button
            onClick={() => onTabChange?.('reports')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'reports' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <FileText size={20} /> Reports
          </button>
          {/* New Gate Requests Tab for Sidebar */}
          <button
             onClick={() => onTabChange?.('verification')}
             className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
               activeTab === 'verification' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
             }`}
           >
             <ShieldCheck size={20} /> Gate Requests
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100">
           <div className="flex items-center gap-3 px-4 py-3 mb-2 bg-slate-50 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                {user.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{user.name.split(' ')[0]}</p>
                <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
              </div>
           </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b border-slate-200 px-5 py-3 sticky top-0 z-30 flex justify-between items-center shadow-sm">
         <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white shadow-sm">
               <BrainCircuit size={20} />
            </div>
            <span className="font-bold text-slate-800 text-lg">MindfulConnect</span>
         </div>
         <div className="flex items-center gap-2">
           <NotificationBell positionClasses="right-0 mt-3 origin-top-right shadow-2xl" />
           <button
            onClick={onLogout}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-slate-50 rounded-full"
          >
            <LogOut size={20} />
          </button>
         </div>
      </header>
      
      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-30 flex justify-around items-center pb-safe safe-area-bottom px-2 shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
        <button
          onClick={() => onTabChange?.('appointments')}
          className={`flex flex-col items-center gap-1 p-2 w-16 ${
            activeTab === 'appointments' ? 'text-indigo-600' : 'text-slate-400'
          }`}
        >
          <LayoutDashboard size={20} />
          <span className="text-[9px] font-bold">Home</span>
        </button>
        <button
          onClick={() => onTabChange?.('availability')}
          className={`flex flex-col items-center gap-1 p-2 w-16 ${
            activeTab === 'availability' ? 'text-indigo-600' : 'text-slate-400'
          }`}
        >
          <Calendar size={20} />
          <span className="text-[9px] font-bold">Time</span>
        </button>
        <button
          onClick={() => onTabChange?.('verification')}
          className={`flex flex-col items-center gap-1 p-2 w-16 ${
            activeTab === 'verification' ? 'text-indigo-600' : 'text-slate-400'
          }`}
        >
          <ShieldCheck size={20} />
          <span className="text-[9px] font-bold">Gate</span>
        </button>
        <button
          onClick={() => onTabChange?.('reports')}
          className={`flex flex-col items-center gap-1 p-2 w-16 ${
            activeTab === 'reports' ? 'text-indigo-600' : 'text-slate-400'
          }`}
        >
          <FileText size={20} />
          <span className="text-[9px] font-bold">Reports</span>
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto pb-24 md:pb-8 max-w-7xl mx-auto w-full">
        {gateRequest && (
          <VerificationModal 
            appointment={gateRequest} 
            onClose={() => setGateRequest(null)} 
          />
        )}
        {children}
      </main>
    </div>
  );
};

export default Layout;
