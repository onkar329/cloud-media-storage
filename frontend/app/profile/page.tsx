'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Mail,
  ArrowLeft,
  Check,
  Shield,
  Clock,
  LogOut,
  Moon,
  Sun,
  KeyRound,
  Database,
} from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [storageUsed, setStorageUsed] = useState(0);
  const [storageLimit] = useState(5 * 1024 * 1024 * 1024);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    if (darkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setDarkMode(true);
    }
  };

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (res.status === 401) return router.push('/login');
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          setName(data.user.name || '');
        }

        const sRes = await fetch('/api/drive/storage', { credentials: 'include' });
        if (sRes.ok) {
          const sData = await sRes.json();
          setStorageUsed(sData.usedBytes || 0);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadData();
  }, []);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast('Name updated');
      setUser((prev) => (prev ? { ...prev, name: data.user.name } : null));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) return alert('Current password required');
    if (newPassword.length < 6) return alert('New password must be at least 6 characters');
    if (newPassword !== confirmPassword) return alert('Passwords do not match');

    setSavingPassword(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const storagePercentage = Math.min(100, (storageUsed / (storageLimit || 1)) * 100);

  return (
    <div className={`min-h-screen font-sans antialiased transition-colors ${darkMode ? 'bg-[#080B11] text-slate-100' : 'bg-[#F8FAFC] text-slate-900'}`}>
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl text-xs font-semibold flex items-center gap-2 border border-slate-700">
          <Check className="h-4 w-4 text-emerald-400" /> {toastMessage}
        </div>
      )}

      <header className={`h-16 border-b px-6 flex items-center justify-between sticky top-0 z-30 ${darkMode ? 'bg-[#0D111A] border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/drive')} className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-2 border ${darkMode ? 'bg-slate-850 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200'}`}>
            <ArrowLeft className="h-4 w-4" /> Back to Drive
          </button>
          <span className="font-bold text-sm">Account Settings</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className={`p-2 rounded-xl border ${darkMode ? 'bg-slate-800 text-amber-400 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button onClick={async () => { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); router.push('/login'); }} className="flex items-center gap-2 text-xs font-semibold px-3 py-2 text-red-500">
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 md:p-10 space-y-8">
        <div className={`p-6 rounded-3xl border shadow-sm flex items-center gap-6 ${darkMode ? 'bg-[#0D111A] border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold uppercase shrink-0">
            {user?.name ? user.name.charAt(0) : 'U'}
          </div>
          <div className="flex-1 space-y-1">
            <h1 className="text-xl font-bold">{user?.name || 'Account'}</h1>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 font-mono"><Mail className="h-3.5 w-3.5" /> {user?.email}</p>
            <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Active'}</p>
          </div>
          <div className="px-3.5 py-1.5 rounded-full bg-blue-600/10 text-blue-500 text-xs font-bold uppercase flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Active Tier
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className={`p-6 rounded-3xl border shadow-sm space-y-4 ${darkMode ? 'bg-[#0D111A] border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-2"><User className="h-4 w-4 text-blue-500" /><h2 className="text-sm font-bold">Personal Details</h2></div>
              <form onSubmit={handleUpdateName} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1.5">Display Name</label>
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={`w-full px-3.5 py-2.5 rounded-xl text-xs border ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-300'}`} />
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={savingProfile} className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-xl">Save Profile</button>
                </div>
              </form>
            </div>

            <div className={`p-6 rounded-3xl border shadow-sm space-y-4 ${darkMode ? 'bg-[#0D111A] border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-amber-500" /><h2 className="text-sm font-bold">Update Password</h2></div>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1.5">Current Password</label>
                  <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={`w-full px-3.5 py-2.5 rounded-xl text-xs border ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-300'}`} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1.5">New Password</label>
                    <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={`w-full px-3.5 py-2.5 rounded-xl text-xs border ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-300'}`} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1.5">Confirm Password</label>
                    <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={`w-full px-3.5 py-2.5 rounded-xl text-xs border ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-300'}`} />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={savingPassword} className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-xl">Update Password</button>
                </div>
              </form>
            </div>
          </div>

          <div className="space-y-6">
            <div className={`p-6 rounded-3xl border shadow-sm space-y-4 ${darkMode ? 'bg-[#0D111A] border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-2"><Database className="h-4 w-4 text-indigo-500" /><h2 className="text-sm font-bold">Storage Usage</h2></div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold"><span>{formatSize(storageUsed)}</span><span className="text-slate-400">{formatSize(storageLimit)}</span></div>
                <div className={`w-full rounded-full h-2 overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: `${storagePercentage}%` }} />
                </div>
                <p className="text-[11px] text-slate-400 text-center">{Math.round(storagePercentage)}% utilized</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}