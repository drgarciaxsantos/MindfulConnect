
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { SystemNotification, User } from '../types';
import { getSystemNotifications, markNotificationRead, markAllNotificationsRead } from '../services/storageService';
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

  // Setup real-time listener and initial fetch
  useEffect(() => {
    if (user) {
      refreshNotifications();

      const channel = supabase
        .channel(`global_notifs_${user.id}`)
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          }, 
          () => {
             refreshNotifications();
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
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
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
    </NotificationContext.Provider>
  );
};
