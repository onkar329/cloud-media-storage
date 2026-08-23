'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Folder,
  FileText,
  Upload,
  FolderPlus,
  Trash2,
  Download,
  LogOut,
  ChevronRight,
  HardDrive,
  Eye,
  Search,
} from 'lucide-react';

interface FileItem {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  storage_key: string;
  folder_id: string | null;
  created_at: string;
}

interface FolderItem {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

interface Breadcrumb {
  id: string | null;
  name: string;
}

export default function DrivePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ id: null, name: 'My Drive' }]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [uploading, setUploading] = useState(false);
  const [storageUsed, setStorageUsed] = useState(0);
  const [storageLimit] = useState(5 * 1024 * 1024 * 1024); // 5GB default

  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);

  // GET /api/drive?folderId=...&search=...
  const fetchData = async () => {
    try {
      const folderParam = currentFolderId ? `folderId=${currentFolderId}` : '';
      const searchParam = searchQuery ? `search=${encodeURIComponent(searchQuery)}` : '';
      const query = [folderParam, searchParam].filter(Boolean).join('&');

      const res = await fetch(`/api/drive${query ? `?${query}` : ''}`, {
        credentials: 'include',
      });

      if (res.status === 401) {
        router.push('/login');
        return;
      }

      if (!res.ok) throw new Error(`HTTP error ${res.status}`);

      const data = await res.json();
      setFolders(data.folders || []);
      setFiles(data.files || []);
      if (data.breadcrumbs && !searchQuery) {
        setBreadcrumbs(data.breadcrumbs);
      }
    } catch (err: any) {
      console.error('Failed to load drive items:', err);
    }
  };

  // GET /api/drive/storage
  const fetchStorage = async () => {
    try {
      const res = await fetch('/api/drive/storage', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setStorageUsed(data.usedBytes || 0);
      }
    } catch (err) {
      console.error('Storage fetch error:', err);
    }
  };

  useEffect(() => {
    fetchData();
    fetchStorage();
  }, [currentFolderId, searchQuery]);

  // POST /api/folders
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newFolderName.trim(),
          parent_id: currentFolderId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${res.status}`);
      }

      setNewFolderName('');
      setIsNewFolderOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to create folder');
    }
  };

  // Upload: Signed URL -> Direct Supabase PUT -> POST /api/files
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];

        // 1. Get Signed URL from Backend
        const initRes = await fetch('/api/files/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            fileName: file.name,
          }),
        });

        if (!initRes.ok) {
          const errData = await initRes.json().catch(() => ({}));
          throw new Error(errData.error || `Failed getting upload URL (${initRes.status})`);
        }
        const { uploadUrl, path } = await initRes.json();

        // 2. Direct binary upload to Supabase Storage
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });

        if (!uploadRes.ok) throw new Error('Direct upload to Supabase failed');

        // 3. Register file metadata in Postgres
        const saveRes = await fetch('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: file.name,
            mime_type: file.type || 'application/octet-stream',
            size_bytes: file.size,
            storage_key: path,
            folder_id: currentFolderId,
          }),
        });

        if (!saveRes.ok) throw new Error('Failed to register file record');
      }

      await fetchData();
      await fetchStorage();
    } catch (err: any) {
      alert(err.message || 'Upload error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // DELETE /api/items/:type/:id
  const handleDelete = async (type: 'folder' | 'file', id: string) => {
    if (!confirm(`Are you sure you want to move this ${type} to trash?`)) return;
    try {
      const res = await fetch(`/api/items/${type}/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      fetchData();
      fetchStorage();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // GET /api/files/:id/url (Preview)
  const handlePreview = async (fileId: string, fileName: string) => {
    try {
      const res = await fetch(`/api/files/${fileId}/url`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Could not fetch file preview URL');
      const data = await res.json();
      setPreviewUrl(data.url);
      setPreviewName(fileName);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // GET /api/files/:id/url (Download)
  const handleDownload = async (fileId: string, fileName: string) => {
    try {
      const res = await fetch(`/api/files/${fileId}/url`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to get download URL');
      const data = await res.json();

      const link = document.createElement('a');
      link.href = data.url;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    router.push('/login');
  };

  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-200 bg-white flex flex-col justify-between p-4">
        <div>
          <div className="flex items-center gap-2 mb-8 px-2">
            <HardDrive className="h-6 w-6 text-blue-600" />
            <span className="font-bold text-lg text-slate-800">Cloud Storage</span>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => {
                setCurrentFolderId(null);
                setSearchQuery('');
              }}
              className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium rounded-lg bg-blue-50 text-blue-700"
            >
              <Folder className="h-4 w-4" />
              My Drive
            </button>
            <button
              onClick={() => router.push('/trash')}
              className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-50"
            >
              <Trash2 className="h-4 w-4" />
              Trash
            </button>
          </nav>
        </div>

        {/* Quota Bar */}
        <div className="border-t border-slate-200 pt-4 space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Storage</span>
              <span>{formatSize(storageUsed)} of {formatSize(storageLimit)}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, (storageUsed / (storageLimit || 1)) * 100)}%` }}
              />
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-red-600 w-full px-2 py-1.5"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6">
          <div className="relative w-96">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search files and folders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleUpload}
              multiple
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading...' : 'Upload File'}
            </button>
            <button
              onClick={() => setIsNewFolderOpen(true)}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              <FolderPlus className="h-4 w-4" />
              New Folder
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Breadcrumb Path */}
          {!searchQuery && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={crumb.id || 'root'}>
                  <button
                    onClick={() => setCurrentFolderId(crumb.id)}
                    className="hover:text-blue-600 font-medium"
                  >
                    {crumb.name}
                  </button>
                  {idx < breadcrumbs.length - 1 && <ChevronRight className="h-4 w-4 text-slate-400" />}
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Folders */}
          {folders.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Folders</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    onClick={() => setCurrentFolderId(folder.id)}
                    className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-blue-400 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <Folder className="h-5 w-5 text-blue-500 flex-shrink-0" />
                      <span className="text-sm font-medium text-slate-800 truncate">{folder.name}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete('folder', folder.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Files Table */}
          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Files</h2>
            {files.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-lg bg-white">
                <Folder className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No files in this folder</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Name</th>
                      <th className="py-3 px-4 font-semibold">Size</th>
                      <th className="py-3 px-4 font-semibold">Date Added</th>
                      <th className="py-3 px-4 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {files.map((file) => (
                      <tr key={file.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 flex items-center gap-3 font-medium text-slate-800">
                          <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                          <span className="truncate max-w-xs">{file.name}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">{formatSize(file.size_bytes)}</td>
                        <td className="py-3 px-4 text-slate-500">
                          {new Date(file.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handlePreview(file.id, file.name)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600"
                              title="Preview"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDownload(file.id, file.name)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600"
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete('file', file.id)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* New Folder Modal */}
      {isNewFolderOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreateFolder} className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <h3 className="font-semibold text-lg text-slate-800">New Folder</h3>
            <input
              type="text"
              autoFocus
              placeholder="Folder Name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewFolderOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center px-4 py-3 border-b">
              <h4 className="font-medium text-sm text-slate-800 truncate">{previewName}</h4>
              <button onClick={() => setPreviewUrl(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <div className="p-4 flex-1 flex items-center justify-center bg-slate-900 overflow-auto">
              <img src={previewUrl} alt={previewName || 'Preview'} className="max-h-[60vh] max-w-full object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}