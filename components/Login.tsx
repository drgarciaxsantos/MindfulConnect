
import React, { useState } from 'react';
import { UserRole, User } from '../types';
import { UserCircle, ShieldCheck, Lock, Hash, Mail, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [role, setRole] = useState<UserRole>(UserRole.STUDENT);
  
  // Student Login State
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [showStudentPassword, setShowStudentPassword] = useState(false);
  
  // Counselor Login State
  const [email, setEmail] = useState('');
  const [counselorPassword, setCounselorPassword] = useState('');
  const [showCounselorPassword, setShowCounselorPassword] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (role === UserRole.STUDENT) {
        // Query the students table
        const { data, error: dbError } = await supabase
          .from('students')
          .select('*')
          .eq('student_id_number', studentId)
          .eq('password', password)
          .single();

        if (dbError || !data) {
          setError('Invalid Student ID or Password. Please check your credentials.');
        } else {
          onLogin({
            id: String(data.id), // Ensure ID is string
            name: data.name,
            role: UserRole.STUDENT,
            studentIdNumber: data.student_id_number,
            section: data.section,
            parentPhoneNumber: data.parent_phone_number
          });
        }
      } else {
        // Counselor Login via Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: email,
          password: counselorPassword
        });

        if (authError) {
          setError(authError.message);
        } else if (authData.user && authData.user.email) {
          // Fetch profile from counselors table
          const { data: profile, error: profileError } = await supabase
             .from('counselors')
             .select('*')
             .eq('email', authData.user.email)
             .single();

          if (profileError || !profile) {
            setError('Account authenticated but counselor profile not found.');
            await supabase.auth.signOut();
          } else {
             onLogin({
               id: String(profile.id), // Ensure ID is string
               name: profile.name,
               role: UserRole.COUNSELOR,
               email: profile.email
             });
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="bg-indigo-600 p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">MindfulConnect</h1>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { setRole(UserRole.STUDENT); setError(''); }}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all ${
                    role === UserRole.STUDENT
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <UserCircle size={18} />
                  Student
                </button>
                <button
                  type="button"
                  onClick={() => { setRole(UserRole.COUNSELOR); setError(''); }}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all ${
                    role === UserRole.COUNSELOR
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <ShieldCheck size={18} />
                  Counselor
                </button>
              </div>
            </div>

            {role === UserRole.STUDENT ? (
              <div className="space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium text-center border border-red-100">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Student ID</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      className="w-full pl-10 px-4 py-3 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    />
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showStudentPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 px-4 py-3 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    />
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <button
                      type="button"
                      onClick={() => setShowStudentPassword(!showStudentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showStudentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium text-center border border-red-100">
                    {error}
                  </div>
                )}
                 <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 px-4 py-3 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    />
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showCounselorPassword ? "text" : "password"}
                      required
                      value={counselorPassword}
                      onChange={(e) => setCounselorPassword(e.target.value)}
                      className="w-full pl-10 pr-10 px-4 py-3 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    />
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <button
                      type="button"
                      onClick={() => setShowCounselorPassword(!showCounselorPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showCounselorPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-200 transition-all disabled:opacity-70 disabled:cursor-wait"
            >
              {loading ? 'Authenticating...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
