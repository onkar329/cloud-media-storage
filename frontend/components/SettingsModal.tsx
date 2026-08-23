'use client';

import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [profile, setProfile] = useState<{ email: string; name: string } | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      api('/auth/me')
        .then((data: any) => {
          setProfile(data);
          setNameInput(data?.name || '');
        })
        .catch((err) => console.error(err));

      setStatus(null);
      setCurrentPassword('');
      setNewPassword('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name: nameInput }),
      });
      setStatus({ type: 'success', message: 'Profile updated successfully' });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('/auth/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setStatus({ type: 'success', message: 'Password updated successfully' });
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-900">Account Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {status && (
            <div
              className={`p-3 rounded-lg text-sm font-medium ${
                status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {status.message}
            </div>
          )}

          {/* Display Name Section */}
          <form onSubmit={handleUpdateProfile} className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-1">Profile</h3>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
              <input
                type="email"
                readOnly
                value={profile?.email || ''}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Display Name</label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <button
              type="submit"
              className="bg-gray-900 hover:bg-black text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
            >
              Save Profile
            </button>
          </form>

          {/* Change Password Section */}
          <form onSubmit={handleUpdatePassword} className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-1">Change Password</h3>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">New Password (8+ chars)</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <button
              type="submit"
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
            >
              Update Password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}