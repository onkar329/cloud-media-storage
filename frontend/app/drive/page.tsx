'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import JSZip from 'jszip';
import { api } from '../../lib/api';
import SettingsModal from '../../components/SettingsModal';

interface Item {
  id: string;
  name: string;
  mime_type?: string;
  size_bytes?: number;
  created_at?: string;
}

interface Breadcrumb {
  id: string;
  name: string;
}

interface StorageUsage {
  usedMB: string;
  limitMB: string;
  percentage: string;
}

export default function DrivePage() {
  const router = useRouter();
  const [folders, setFolders] = useState<Item[]>([]);
  const [files, setFiles] = useState<Item[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'created_at' | 'name' | 'size_bytes'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [preview, setPreview] = useState<{ url: string; name: string; type: string } | null>(null);
  const [shareLink, setShareLink] = useState<{ url: string; name: string } | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  async function loadData() {
    try {
      const endpoint = currentFolderId
        ? `/folders/${currentFolderId}?sortBy=${sortBy}&order=${sortOrder}`
        : `/folders?sortBy=${sortBy}&order=${sortOrder}`;

      const res: any = await api(endpoint);
      if (currentFolderId) {
        setFolders(res.children?.folders || []);
        setFiles(res.children?.files || []);
        setBreadcrumbs(res.breadcrumbs || []);
      } else {
        setFolders(res.folders || []);
        setFiles(res.files || []);
        setBreadcrumbs([]);
      }

      const storageRes: any = await api('/storage/usage');
      setUsage(storageRes);
      setSelectedFileIds([]);
    } catch (err) {
      console.error('Failed to load items', err);
    }
  }

  useEffect(() => {
    loadData();
  }, [currentFolderId, sortBy, sortOrder]);

  function toggleFileSelection(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedFileIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function handleSelectAll() {
    if (selectedFileIds.length === files.length) {
      setSelectedFileIds([]);
    } else {
      setSelectedFileIds(files.map((f) => f.id));
    }
  }

  async function handleBulkDelete() {
    if (!confirm(`Move ${selectedFileIds.length} selected item(s) to trash?`)) return;
    try {
      await api('/files/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ fileIds: selectedFileIds }),
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Bulk delete failed');
    }
  }

  async function handleBulkDownloadZip() {
    if (selectedFileIds.length === 0) return;
    setIsArchiving(true);
    try {
      const zip = new JSZip();
      const selectedFiles = files.filter((f) => selectedFileIds.includes(f.id));

      for (const file of selectedFiles) {
        const res: any = await api(`/files/${file.id}`);
        const blob = await fetch(res.signedUrl).then((r) => r.blob());
        zip.file(file.name, blob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `drive-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to generate ZIP download');
    } finally {
      setIsArchiving(false);
    }
  }

  async function uploadFileObject(file: File) {
    setUploading(true);
    try {
      const init: any = await api('/files/init', {
        method: 'POST',
        body: JSON.stringify({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          folderId: currentFolderId,
        }),
      });

      const uploadRes = await fetch(init.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });

      if (!uploadRes.ok) throw new Error('Upload failed');

      await api('/files/complete', {
        method: 'POST',
        body: JSON.stringify({ fileId: init.fileId }),
      });

      loadData();
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFileObject(file);
  }

  async function handleCreateFolder() {
    const name = prompt('Folder name?');
    if (!name?.trim()) return;

    try {
      await api('/folders', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), parentId: currentFolderId }),
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error creating folder');
    }
  }

  async function handleFileClick(file: Item) {
    try {
      const res: any = await api(`/files/${file.id}`);
      if (file.mime_type?.startsWith('image/') || file.mime_type === 'application/pdf') {
        setPreview({ url: res.signedUrl, name: file.name, type: file.mime_type });
      } else {
        window.open(res.signedUrl, '_blank');
      }
    } catch (err: any) {
      alert(err.message || 'Error opening file');
    }
  }

  async function handleShare(id: string, name: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const res: any = await api(`/files/${id}/share`, {
        method: 'POST',
        body: JSON.stringify({ expiresIn: 86400 }),
      });
      setShareLink({ url: res.shareUrl, name });
    } catch (err: any) {
      alert(err.message || 'Failed to create share link');
    }
  }

  async function handleRename(id: string, currentName: string, e: React.MouseEvent) {
    e.stopPropagation();
    const newName = prompt('New name:', currentName);
    if (!newName || newName.trim() === currentName) return;

    try {
      await api(`/files/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: newName.trim() }),
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Rename failed');
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Move file to trash?')) return;

    try {
      await api(`/files/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    }
  }

  async function handleLogout() {
    await api('/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const filteredFolders = folders.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));
  const filteredFiles = files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className="min-h-screen bg-gray-50 p-8 relative"
    >
      {isDragging && (
        <div className="fixed inset-0 bg-blue-600/10 border-4 border-dashed border-blue-500 z-50 pointer-events-none flex items-center justify-center backdrop-blur-xs">
          <div className="bg-white px-8 py-4 rounded-2xl shadow-xl border border-blue-200">
            <p className="text-blue-600 font-semibold text-lg">📁 Drop file to upload immediately</p>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Cloud Media Storage</h1>

          <div className="flex items-center gap-4">
            {usage && (
              <div className="w-36 text-xs text-gray-500">
                <div className="flex justify-between mb-1">
                  <span>{usage.usedMB} MB</span>
                  <span>{usage.limitMB} MB</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-blue-600 h-1.5 rounded-full transition-all" style={{ width: `${usage.percentage}%` }} />
                </div>
              </div>
            )}

            <input
              type="text"
              placeholder="Search in drive..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none w-44"
            />
            <Link href="/trash" className="border border-gray-300 hover:bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium transition">
              🗑️ Trash
            </Link>
            <button onClick={() => setIsSettingsOpen(true)} className="border border-gray-300 hover:bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium transition">
              ⚙️ Settings
            </button>
            <button onClick={handleLogout} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium transition">
              Logout
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600 bg-white px-4 py-3 rounded-xl border border-gray-200 shadow-xs">
          <button onClick={() => setCurrentFolderId(null)} className={`font-semibold hover:text-blue-600 ${!currentFolderId ? 'text-blue-600' : ''}`}>
            Root
          </button>
          {breadcrumbs.map((crumb, idx) => (
            <div key={crumb.id} className="flex items-center gap-2">
              <span className="text-gray-400">/</span>
              <button onClick={() => setCurrentFolderId(crumb.id)} className={`hover:text-blue-600 ${idx === breadcrumbs.length - 1 ? 'font-bold text-gray-900' : ''}`}>
                {crumb.name}
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <button onClick={handleCreateFolder} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition shadow-sm">
              + New Folder
            </button>

            <label className="border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-medium text-sm cursor-pointer transition shadow-sm">
              {uploading ? 'Uploading...' : '↑ Upload File'}
              <input type="file" onChange={(e) => e.target.files?.[0] && uploadFileObject(e.target.files[0])} disabled={uploading} className="hidden" />
            </label>

            {selectedFileIds.length > 0 && (
              <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                <span className="text-xs font-semibold text-blue-700">{selectedFileIds.length} Selected</span>
                <button onClick={handleBulkDownloadZip} disabled={isArchiving} className="bg-white border border-blue-300 hover:bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded font-medium transition">
                  {isArchiving ? 'Archiving...' : '📦 Download ZIP'}
                </button>
                <button onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700 text-white text-xs px-2.5 py-1 rounded font-medium transition">
                  Delete Selected
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 text-sm text-gray-600">
            {files.length > 0 && (
              <button onClick={handleSelectAll} className="text-xs text-blue-600 hover:underline font-medium">
                {selectedFileIds.length === files.length ? 'Deselect All' : 'Select All'}
              </button>
            )}

            <span>Sort:</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none">
              <option value="created_at">Date Added</option>
              <option value="name">Name</option>
              <option value="size_bytes">Size</option>
            </select>
            <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="bg-white border border-gray-300 px-2 py-1.5 rounded-lg text-xs hover:bg-gray-50">
              {sortOrder === 'asc' ? '▲ Asc' : '▼ Desc'}
            </button>
          </div>
        </div>

        {filteredFolders.length > 0 && (
          <div>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Folders</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredFolders.map((folder) => (
                <div key={folder.id} onClick={() => setCurrentFolderId(folder.id)} className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm flex items-center gap-3 cursor-pointer hover:border-blue-500 hover:shadow-md transition">
                  <span className="text-2xl">📁</span>
                  <span className="font-semibold text-gray-800 truncate">{folder.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Files</h2>
          {filteredFiles.length === 0 ? (
            <div className="text-center bg-white p-12 rounded-2xl border-2 border-dashed border-gray-200">
              <p className="text-3xl mb-2">📂</p>
              <p className="font-semibold text-gray-700">No files found</p>
              <p className="text-xs text-gray-400 mt-1">Drag and drop files anywhere to upload</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredFiles.map((file) => {
                const isSelected = selectedFileIds.includes(file.id);
                return (
                  <div
                    key={file.id}
                    onClick={() => handleFileClick(file)}
                    className={`border rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition flex flex-col justify-between cursor-pointer relative ${
                      isSelected ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => toggleFileSelection(file.id, e as any)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="text-2xl">{file.mime_type?.startsWith('image/') ? '🖼️' : '📄'}</span>
                      <div className="overflow-hidden">
                        <p className="font-semibold text-gray-900 truncate">{file.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {file.size_bytes ? `${(file.size_bytes / (1024 * 1024)).toFixed(2)} MB` : ''} • {file.mime_type?.split('/')[1] || 'file'}
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-end gap-1.5 mt-4 pt-3 border-t border-gray-100">
                      <button onClick={(e) => handleShare(file.id, file.name, e)} className="text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 font-medium px-2 py-1 rounded">
                        🔗 Share
                      </button>
                      <button onClick={(e) => handleRename(file.id, file.name, e)} className="text-xs text-blue-600 hover:bg-blue-50 font-medium px-2 py-1 rounded">
                        Rename
                      </button>
                      <button onClick={(e) => handleDelete(file.id, e)} className="text-xs text-red-600 hover:bg-red-50 font-medium px-2 py-1 rounded">
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {shareLink && (
        <div onClick={() => setShareLink(null)} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div onClick={(e) => e.stopPropagation()} className="bg-white p-6 rounded-2xl max-w-md w-full shadow-2xl border border-gray-100 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-900">Share "{shareLink.name}"</h3>
              <button onClick={() => setShareLink(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-xs text-gray-500">Anyone with this link can view this file for 24 hours.</p>
            <div className="flex gap-2">
              <input type="text" readOnly value={shareLink.url} className="w-full bg-gray-50 border rounded-lg px-3 py-2 text-xs select-all text-gray-700" />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareLink.url);
                  alert('Copied to clipboard!');
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shrink-0 transition"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div onClick={() => setPreview(null)} className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6 backdrop-blur-sm">
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-semibold text-gray-900 truncate">{preview.name}</h3>
              <button onClick={() => setPreview(null)} className="text-gray-500 hover:text-gray-900 text-lg px-2">✕</button>
            </div>
            <div className="p-4 flex-1 overflow-auto flex items-center justify-center min-h-[400px] bg-gray-50">
              {preview.type.startsWith('image/') ? (
                <img src={preview.url} alt={preview.name} className="max-h-[75vh] object-contain rounded-lg shadow" />
              ) : (
                <iframe src={preview.url} className="w-full h-[75vh] rounded-lg border" />
              )}
            </div>
          </div>
        </div>
      )}

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}