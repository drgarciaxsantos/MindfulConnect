
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { X, CheckCircle, AlertCircle, Info, Footprints } from 'lucide-react';
import { SystemNotification, User } from '../types';
import { getSystemNotifications, markNotificationRead, markAllNotificationsRead } from '../services/storageService';

export type NotificationType = 'success' | 'error' | 'info' | 'incoming';

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
  const [toasts, setToasts] = useState<Toast[]>([]);
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
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    await markNotificationRead(id);
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    await markAllNotificationsRead(user.id);
    showNotification('All notifications marked as read', 'success');
  }, [user, refreshNotifications]);

  const showNotification = useCallback((message: string, type: NotificationType) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000); // Slightly longer timeout to read high priority messages
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    if (user) {
      refreshNotifications();
      const interval = setInterval(refreshNotifications, 60000);
      return () => clearInterval(interval);
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
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-full max-w-sm px-4">
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className={`flex items-center gap-3 p-4 rounded-xl shadow-lg border animate-in slide-in-from-bottom-4 duration-300 ${
              toast.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' :
              toast.type === 'error' ? 'bg-red-50 border-red-100 text-red-800' :
              toast.type === 'incoming' ? 'bg-cyan-50 border-cyan-200 text-cyan-800 border-l-4 border-l-cyan-500 shadow-cyan-100' :
              'bg-blue-50 border-blue-100 text-blue-800'
            }`}
          >
            {toast.type === 'success' && <CheckCircle size={20} />}
            {toast.type === 'error' && <AlertCircle size={20} />}
            {toast.type === 'info' && <Info size={20} />}
            {toast.type === 'incoming' && <div className="animate-bounce"><Footprints size={20} /></div>}
            <p className="text-sm font-medium flex-1">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} className="p-1 hover:bg-black/5 rounded">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};
