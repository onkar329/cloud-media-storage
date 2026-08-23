'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    try {
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      router.push('/drive');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4"
        suppressHydrationWarning
      >
        <h1 className="text-2xl font-bold text-gray-900">Create account</h1>

        <div>
          <input
            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Name"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            suppressHydrationWarning
          />
        </div>

        <div>
          <input
            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            suppressHydrationWarning
          />
        </div>

        <div>
          <input
            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Password (min 8 characters)"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={8}
            suppressHydrationWarning
          />
        </div>

        {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg p-3 text-sm disabled:opacity-50 transition"
          suppressHydrationWarning
        >
          {loading ? 'Registering...' : 'Register'}
        </button>

        <p className="text-center text-xs text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </main>
  );
}