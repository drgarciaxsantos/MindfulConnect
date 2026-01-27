
import React, { useState } from 'react';
import { User } from '../types';
import { Bell, Check, Trash2, CheckCircle2, Clock } from 'lucide-react';
import { useNotification } from './Notifications';

interface NotificationCenterProps {
  user: User;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ user }) => {
  const { notifications, markAsRead, markAllAsRead } = useNotification();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const handleMarkRead = async (id: string) => {
    await markAsRead(id);
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.isRead;
    return true;
  });

  return (
    <div className="space-y-6 pb-24">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Bell className="text-indigo-600" /> Notifications
          </h2>
          <p className="text-slate-500">Stay updated with your appointments and transfers.</p>
        </div>

        <div className="flex flex-wrap gap-2">
           <div className="flex bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
             <button
               onClick={() => setFilter('all')}
               className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                 filter === 'all' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50'
               }`}
             >
               All
             </button>
             <button
               onClick={() => setFilter('unread')}
               className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                 filter === 'unread' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50'
               }`}
             >
               Unread
             </button>
           </div>
           
           <button
             onClick={handleMarkAllRead}
             disabled={notifications.every(n => n.isRead)}
             className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center gap-2"
           >
             <CheckCircle2 size={16} />
             Mark all as read
           </button>
        </div>
      </header>

      {filteredNotifications.length === 0 ? (
        <div className="bg-white p-16 rounded-xl border border-dashed border-slate-300 text-center flex flex-col items-center">
          <div className="bg-slate-50 p-4 rounded-full mb-4">
            <Bell size={32} className="text-slate-300" />
          </div>
          <p className="text-slate-600 font-medium">No {filter === 'unread' ? 'unread' : ''} notifications found.</p>
          <p className="text-slate-400 text-sm mt-1">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-3 max-w-3xl mx-auto">
          {filteredNotifications.map(n => (
            <div 
              key={n.id} 
              className={`p-5 rounded-xl border transition-all hover:shadow-md flex gap-4 ${
                n.isRead ? 'bg-white border-slate-200' : 'bg-indigo-50 border-indigo-100 shadow-sm'
              }`}
            >
              <div className={`mt-1 p-2 rounded-full flex-shrink-0 ${n.isRead ? 'bg-slate-100 text-slate-400' : 'bg-indigo-200 text-indigo-600'}`}>
                <Bell size={20} fill={!n.isRead ? "currentColor" : "none"} />
              </div>
              
              <div className="flex-1">
                <p className={`text-sm leading-relaxed ${n.isRead ? 'text-slate-600' : 'text-slate-900 font-semibold'}`}>
                  {n.message}
                </p>
                <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                  <Clock size={12} />
                  <span>
                    {new Date(n.createdAt).toLocaleDateString(undefined, {
                      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                    })} at {new Date(n.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
              </div>

              {!n.isRead && (
                <button
                  onClick={() => handleMarkRead(n.id)}
                  className="self-start p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                  title="Mark as read"
                >
                  <Check size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
