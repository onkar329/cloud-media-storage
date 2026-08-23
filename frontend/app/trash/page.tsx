'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';

interface TrashItem {
  id: string;
  name: string;
  mime_type: string;
  created_at: string;
}

export default function TrashPage() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadTrash() {
    try {
      const res: any = await api('/trash');
      setItems(res.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTrash();
  }, []);

  async function handleRestore(id: string) {
    try {
      await api('/files/complete', {
        method: 'POST',
        body: JSON.stringify({ fileId: id }),
      });
      loadTrash();
    } catch (err: any) {
      alert(err.message || 'Failed to restore');
    }
  }

  async function handlePermanentDelete(id: string) {
    if (!confirm('Permanently delete this file from storage? This action cannot be undone.')) return;
    try {
      await api(`/trash/${id}`, { method: 'DELETE' });
      loadTrash();
    } catch (err: any) {
      alert(err.message || 'Failed to permanently delete');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Trash Bin</h1>
            <p className="text-xs text-gray-500">Restore items or delete them permanently</p>
          </div>
          <Link href="/drive" className="border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition">
            ← Back to Drive
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          {loading ? (
            <p className="p-6 text-sm text-gray-500">Loading trash...</p>
          ) : items.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-500">Trash is completely empty.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {items.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🗑️</span>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.mime_type}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleRestore(item.id)} className="bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium px-3 py-1.5 rounded-lg text-xs transition">
                      Restore
                    </button>
                    <button onClick={() => handlePermanentDelete(item.id)} className="bg-red-50 text-red-600 hover:bg-red-100 font-medium px-3 py-1.5 rounded-lg text-xs transition">
                      Delete Forever
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}