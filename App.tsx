
import React, { useState, useEffect } from 'react';
import { User, UserRole } from './types';
import Login from './components/Login';
import Layout from './components/Layout';
import StudentDashboard from './components/student/StudentDashboard';
import CounselorDashboard from './components/counselor/CounselorDashboard';
import CounselorReports from './components/counselor/CounselorReports';
import VerificationTab from './components/counselor/VerificationTab';
import NotificationCenter from './components/NotificationCenter';
import { initMockData } from './services/storageService';
import { NotificationProvider, useNotification } from './components/Notifications';
import { supabase } from './services/supabaseClient';

const AppContent: React.FC<{
  user: User | null;
  setUser: (user: User | null) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}> = ({ user, setUser, activeTab, setActiveTab }) => {
  const { setUser: setNotificationUser } = useNotification();

  useEffect(() => {
    setNotificationUser(user);
  }, [user, setNotificationUser]);

  const handleLogout = async () => {
    if (user?.role === UserRole.COUNSELOR) {
      await supabase.auth.signOut();
    }
    setUser(null);
    localStorage.removeItem('mc_user');
  };

  const setDefaultTab = (role: UserRole) => {
    if (role === UserRole.STUDENT) setActiveTab('book');
    else setActiveTab('appointments');
  };

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem('mc_user', JSON.stringify(newUser));
    setDefaultTab(newUser.role);
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Layout 
      user={user} 
      onLogout={handleLogout}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === 'notifications' && <NotificationCenter user={user} />}
      
      {user.role === UserRole.STUDENT ? (
        <>
          {activeTab === 'book' && <StudentDashboard user={user} activeTab={activeTab} />}
          {activeTab === 'my-appointments' && <StudentDashboard user={user} activeTab={activeTab} />}
        </>
      ) : (
        <>
          {activeTab === 'appointments' && <CounselorDashboard user={user} activeTab={activeTab} />}
          {activeTab === 'availability' && <CounselorDashboard user={user} activeTab={activeTab} />}
          {activeTab === 'verification' && <VerificationTab user={user} />}
          {activeTab === 'reports' && <CounselorReports user={user} />}
        </>
      )}
    </Layout>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    initMockData();
    const storedUser = localStorage.getItem('mc_user');
    if (storedUser) {
      const u = JSON.parse(storedUser);
      setUser(u);
      if (u.role === UserRole.STUDENT) setActiveTab('book');
      else setActiveTab('appointments');
    }
  }, []);

  return (
    <NotificationProvider>
      <AppContent 
        user={user} 
        setUser={setUser} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />
    </NotificationProvider>
  );
};

export default App;
