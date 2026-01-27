
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole } from '../types';
import { LogOut, LayoutDashboard, Calendar, FileText, CalendarPlus, CalendarCheck, Bell, Check, ArrowRight, ShieldCheck } from 'lucide-react';
import { checkAndSendReminders } from '../services/storageService';
import { useNotification } from './Notifications';

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

  useEffect(() => {
    if (user) {
      checkAndSendReminders(user.id);
    }
  }, [user?.id]);

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
            <span className="text-[10px] font-bold">Status</span>
          </button>
        </nav>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 md:h-screen sticky top-0 z-30 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <span className="font-bold text-lg text-slate-800 tracking-tight">MindfulConnect</span>
        </div>

        <div className="p-4 flex-1">
          <div className="mb-6 px-4 py-4 bg-gradient-to-br from-indigo-50 to-white rounded-xl border border-indigo-100/50 shadow-sm">
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Counselor</p>
            <p className="font-bold text-slate-900 truncate leading-tight">{user.name}</p>
          </div>

          <nav className="space-y-1.5">
            {[
              { id: 'appointments', label: 'Appointments', icon: LayoutDashboard },
              { id: 'verification', label: 'Gate Access', icon: ShieldCheck },
              { id: 'availability', label: 'Availability', icon: Calendar },
              { id: 'reports', label: 'Reports', icon: FileText },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => onTabChange?.(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === item.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
                }`}
              >
                <item.icon size={18} strokeWidth={activeTab === item.id ? 2.5 : 2} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-100 bg-white">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 md:px-8 shrink-0 z-20 shadow-sm">
           <div className="flex items-center gap-2 text-sm">
             <span className="text-slate-400 font-medium">Guidance Portal</span>
             <span className="text-slate-300">/</span>
             <span className="text-slate-900 font-bold capitalize">{activeTab?.replace('-', ' ')}</span>
           </div>

           <div className="flex items-center gap-4">
             <NotificationBell positionClasses="right-0 mt-3 origin-top-right shadow-2xl" />
           </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8 bg-slate-50/50">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
