'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Trash2,
  RotateCcw,
  ArrowLeft,
  HardDrive,
  Folder,
  FileText,
  AlertTriangle,
  Sun,
  Moon,
  Check,
  Eye,
  Music,
  Video,
  FileCode,
  Code2,
} from 'lucide-react';

interface TrashItem {
  id: string;
  name: string;
  mime_type?: string;
  size_bytes?: number;
  created_at: string;
  type: 'file' | 'folder';
}

export default function TrashPage() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

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

  const fetchTrash = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/trash', { credentials: 'include' });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (!res.ok) throw new Error('Failed to load trash items');

      const data = await res.json();
      const folderList: TrashItem[] = (data.folders || []).map((f: any) => ({ ...f, type: 'folder' }));
      const fileList: TrashItem[] = (data.files || []).map((f: any) => ({ ...f, type: 'file' }));

      setTrashItems([...folderList, ...fileList]);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error loading trash');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrash();
  }, []);

  const handleRestore = async (item: TrashItem) => {
    setProcessingId(item.id);
    try {
      const res = await fetch('/api/trash/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: item.type, id: item.id }),
      });
      if (!res.ok) throw new Error('Restore failed');

      showToast(`Restored "${item.name}"`);
      setTrashItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handlePermanentDelete = async (item: TrashItem) => {
    if (!confirm(`Permanently delete "${item.name}"? This cannot be undone.`)) return;

    setProcessingId(item.id);
    try {
      const res = await fetch('/api/trash/permanent', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: item.type, id: item.id }),
      });
      if (!res.ok) throw new Error('Permanent deletion failed');

      showToast(`Permanently deleted "${item.name}"`);
      setTrashItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleEmptyTrash = async () => {
    if (trashItems.length === 0) return;
    if (!confirm(`Empty all ${trashItems.length} items from the Recycle Bin? This cannot be undone.`)) return;

    for (const item of trashItems) {
      await fetch('/api/trash/permanent', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: item.type, id: item.id }),
      });
    }

    setTrashItems([]);
    showToast('Recycle Bin emptied');
  };

  const renderItemIcon = (item: TrashItem) => {
    if (item.type === 'folder') return <Folder className="h-4 w-4 text-amber-500" />;
    const mime = item.mime_type || '';
    if (mime.startsWith('image/')) return <Eye className="h-4 w-4 text-emerald-500" />;
    if (mime.startsWith('video/')) return <Video className="h-4 w-4 text-indigo-500" />;
    if (mime.startsWith('audio/')) return <Music className="h-4 w-4 text-amber-500" />;
    if (item.name.endsWith('.js') || item.name.endsWith('.ts') || item.name.endsWith('.py')) {
      return <Code2 className="h-4 w-4 text-sky-500" />;
    }
    if (mime.includes('pdf') || mime.includes('document')) return <FileText className="h-4 w-4 text-blue-500" />;
    return <FileCode className="h-4 w-4 text-slate-400" />;
  };

  const formatSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`min-h-screen font-sans antialiased transition-colors ${darkMode ? 'bg-[#080B11] text-slate-100' : 'bg-[#F8FAFC] text-slate-900'}`}>
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl text-xs font-semibold flex items-center gap-2 border border-slate-700">
          <Check className="h-4 w-4 text-emerald-400" /> {toastMessage}
        </div>
      )}

      {/* Top Bar */}
      <header className={`h-16 border-b px-6 flex items-center justify-between sticky top-0 z-30 ${darkMode ? 'bg-[#0D111A] border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/drive')}
            className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition ${
              darkMode ? 'bg-slate-850 border-slate-700 text-slate-300 hover:bg-slate-800' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Drive
          </button>
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-red-500" />
            <span className="font-bold text-sm">Recycle Bin</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {trashItems.length > 0 && (
            <button
              onClick={handleEmptyTrash}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-red-500 text-xs font-semibold border border-red-500/20 transition"
            >
              <Trash2 className="h-3.5 w-3.5" /> Empty Bin
            </button>
          )}

          <button
            onClick={toggleTheme}
            className={`p-2 rounded-xl border transition ${
              darkMode ? 'bg-slate-800 text-amber-400 border-slate-700' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto p-6 md:p-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Deleted Resources</h1>
            <p className="text-xs text-slate-400">Items in the recycle bin can be restored back to your drive or permanently purged.</p>
          </div>
          <span className="text-xs font-bold text-slate-400">{trashItems.length} items</span>
        </div>

        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400 animate-pulse">Loading deleted assets...</div>
        ) : trashItems.length === 0 ? (
          <div className={`text-center py-20 border-2 border-dashed rounded-3xl ${darkMode ? 'border-slate-800 bg-[#0D111A]/40' : 'border-slate-200 bg-white'}`}>
            <Trash2 className="h-10 w-10 text-slate-400 mx-auto mb-2 opacity-40" />
            <p className="text-xs font-semibold text-slate-400">Recycle Bin is empty</p>
          </div>
        ) : (
          <div className={`border rounded-2xl overflow-hidden shadow-xs ${darkMode ? 'bg-[#0D111A] border-slate-800' : 'bg-white border-slate-200'}`}>
            <table className="w-full text-left text-xs">
              <thead className={`border-b text-[11px] font-bold uppercase ${darkMode ? 'bg-slate-950/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                <tr>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Deleted Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${darkMode ? 'divide-slate-800/60' : 'divide-slate-100'}`}>
                {trashItems.map((item) => (
                  <tr key={item.id} className={`transition ${darkMode ? 'hover:bg-slate-850/50' : 'hover:bg-slate-50'}`}>
                    <td className="py-3 px-4 flex items-center gap-3 font-semibold">
                      {renderItemIcon(item)}
                      <span className="truncate max-w-xs">{item.name}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 capitalize">{item.type}</td>
                    <td className="py-3 px-4 text-slate-400">{formatSize(item.size_bytes)}</td>
                    <td className="py-3 px-4 text-slate-400">{new Date(item.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleRestore(item)}
                          disabled={processingId === item.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 border border-blue-500/20 transition disabled:opacity-50"
                        >
                          <RotateCcw className="h-3 w-3" /> Restore
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(item)}
                          disabled={processingId === item.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 transition disabled:opacity-50"
                        >
                          <Trash2 className="h-3 w-3" /> Delete Forever
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}