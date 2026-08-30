'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Editor from '@monaco-editor/react';
import {
  Folder,
  FileText,
  Upload,
  FolderPlus,
  Trash2,
  Download,
  Share2,
  LogOut,
  ChevronRight,
  HardDrive,
  Eye,
  Search,
  Moon,
  Sun,
  Archive,
  CheckSquare,
  Square,
  UploadCloud,
  Edit3,
  Copy,
  Check,
  Music,
  Video,
  FileCode,
  LayoutGrid,
  List,
  ArrowUpDown,
  Info,
  X,
  Database,
  ExternalLink,
  Star,
  PieChart,
  Code2,
} from 'lucide-react';
import JSZip from 'jszip';

interface FileItem {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  storage_key: string;
  folder_id: string | null;
  created_at: string;
  is_starred?: boolean;
}

interface FolderItem {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  is_starred?: boolean;
}

interface Breadcrumb {
  id: string | null;
  name: string;
}

type FilterCategory = 'all' | 'image' | 'video' | 'audio' | 'document' | 'code';
type SortField = 'name' | 'size_bytes' | 'created_at';
type SortOrder = 'asc' | 'desc';

// Language Detector for Monaco
const getLanguageFromFileName = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    html: 'html',
    css: 'css',
    scss: 'scss',
    json: 'json',
    md: 'markdown',
    markdown: 'markdown',
    sql: 'sql',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    cs: 'csharp',
    go: 'go',
    rs: 'rust',
    php: 'php',
    rb: 'ruby',
    sh: 'shell',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    txt: 'plaintext',
  };
  return languageMap[ext] || 'plaintext';
};

export default function DrivePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Appearance & Viewport
  const [darkMode, setDarkMode] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [isStarredView, setIsStarredView] = useState(false);

  // Core Data
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ id: null, name: 'Storage Vault' }]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);

  // Selection & Details Inspector
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [activeInspectorItem, setActiveInspectorItem] = useState<FileItem | null>(null);

  // Storage & Analytics
  const [storageUsed, setStorageUsed] = useState(0);
  const [storageLimit] = useState(5 * 1024 * 1024 * 1024);
  const [storageBreakdown, setStorageBreakdown] = useState({
    images: 0,
    videos: 0,
    audio: 0,
    documents: 0,
    others: 0,
  });
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);

  // Operations
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Modals
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameTarget, setRenameTarget] = useState<{ type: 'folder' | 'file'; id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [previewData, setPreviewData] = useState<{ url: string; name: string; mime: string } | null>(null);
  const [shareFileId, setShareFileId] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState<'viewer' | 'editor'>('viewer');
  const [sharing, setSharing] = useState(false);

  // Monaco Document Editor State
  const [editorData, setEditorData] = useState<{
    isOpen: boolean;
    fileId: string | null;
    fileName: string;
    content: string;
    isSaving: boolean;
    isNew: boolean;
  }>({
    isOpen: false,
    fileId: null,
    fileName: '',
    content: '',
    isSaving: false,
    isNew: false,
  });

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

  const fetchData = async () => {
    try {
      const folderParam = currentFolderId ? `folderId=${currentFolderId}` : '';
      const searchParam = searchQuery ? `search=${encodeURIComponent(searchQuery)}` : '';
      const starParam = isStarredView ? `starred=true` : '';
      const query = [folderParam, searchParam, starParam].filter(Boolean).join('&');

      const res = await fetch(`/api/drive${query ? `?${query}` : ''}`, { credentials: 'include' });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);

      const data = await res.json();
      setFolders(data.folders || []);
      setFiles(data.files || []);
      setSelectedFileIds([]);
      if (data.breadcrumbs && !searchQuery && !isStarredView) {
        setBreadcrumbs(data.breadcrumbs);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStorage = async () => {
    try {
      const res = await fetch('/api/drive/storage', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStorageUsed(data.usedBytes || 0);
        if (data.breakdown) setStorageBreakdown(data.breakdown);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
    fetchStorage();
  }, [currentFolderId, searchQuery, isStarredView]);

  const processedFiles = useMemo(() => {
    let result = [...files];

    if (selectedCategory !== 'all') {
      result = result.filter((f) => {
        if (selectedCategory === 'image') return f.mime_type.startsWith('image/');
        if (selectedCategory === 'video') return f.mime_type.startsWith('video/');
        if (selectedCategory === 'audio') return f.mime_type.startsWith('audio/');
        if (selectedCategory === 'code') {
          return (
            f.name.endsWith('.js') ||
            f.name.endsWith('.ts') ||
            f.name.endsWith('.tsx') ||
            f.name.endsWith('.py') ||
            f.name.endsWith('.json') ||
            f.name.endsWith('.html') ||
            f.name.endsWith('.css') ||
            f.name.endsWith('.sql')
          );
        }
        if (selectedCategory === 'document') {
          return (
            f.mime_type.includes('pdf') ||
            f.mime_type.includes('word') ||
            f.mime_type.includes('text') ||
            f.mime_type.includes('document')
          );
        }
        return true;
      });
    }

    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'size_bytes') {
        comparison = a.size_bytes - b.size_bytes;
      } else {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [files, selectedCategory, sortField, sortOrder]);

  const toggleStar = async (type: 'folder' | 'file', id: string, currentState: boolean = false) => {
    try {
      const res = await fetch(`/api/items/${type}/${id}/star`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_starred: !currentState }),
      });
      if (!res.ok) throw new Error('Failed to update star state');
      showToast(!currentState ? 'Added to Starred' : 'Removed from Starred');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const deleteItem = async (type: 'folder' | 'file', id: string) => {
    try {
      const res = await fetch(`/api/items/${type}/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Deletion failed');
      if (activeInspectorItem?.id === id) setActiveInspectorItem(null);
      setSelectedFileIds((prev) => prev.filter((item) => item !== id));
      fetchData();
      fetchStorage();
      showToast('Item moved to trash');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBatchDelete = async () => {
    if (!confirm(`Move ${selectedFileIds.length} selected items to trash?`)) return;
    for (const id of selectedFileIds) {
      await fetch(`/api/items/file/${id}`, { method: 'DELETE', credentials: 'include' });
    }
    setSelectedFileIds([]);
    setActiveInspectorItem(null);
    fetchData();
    fetchStorage();
    showToast('Batch deletion complete');
  };

  const processUpload = async (fileList: FileList | File[]) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        setUploadProgress(`Uploading ${file.name} (${i + 1}/${fileList.length})...`);

        const initRes = await fetch('/api/files/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ fileName: file.name }),
        });

        if (!initRes.ok) throw new Error('Signed upload URL initialization failed');
        const { uploadUrl, path } = await initRes.json();

        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!uploadRes.ok) throw new Error('Direct upload to storage provider failed');

        await fetch('/api/files', {
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
      }
      showToast('All items uploaded securely');
      await fetchData();
      await fetchStorage();
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Monaco Editor Methods
  const handleOpenMonaco = async (file: FileItem) => {
    try {
      const res = await fetch(`/api/files/${file.id}/content`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load code content');

      setEditorData({
        isOpen: true,
        fileId: file.id,
        fileName: file.name,
        content: data.content,
        isSaving: false,
        isNew: false,
      });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateNewFile = () => {
    setEditorData({
      isOpen: true,
      fileId: null,
      fileName: 'main.js',
      content: '// Start coding in Monaco Editor\nconsole.log("Hello from Cloud Media Storage!");\n',
      isSaving: false,
      isNew: true,
    });
  };

  const handleSaveMonaco = async () => {
    if (!editorData.fileName.trim()) {
      alert('Please provide a valid file name');
      return;
    }

    setEditorData((prev) => ({ ...prev, isSaving: true }));
    try {
      if (editorData.isNew) {
        const initRes = await fetch('/api/files/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ fileName: editorData.fileName }),
        });
        const { uploadUrl, path } = await initRes.json();

        const blob = new Blob([editorData.content], { type: 'text/plain' });
        await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'text/plain' },
          body: blob,
        });

        await fetch('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: editorData.fileName,
            mime_type: 'text/plain',
            size_bytes: blob.size,
            storage_key: path,
            folder_id: currentFolderId,
          }),
        });
      } else {
        const res = await fetch(`/api/files/${editorData.fileId}/content`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ content: editorData.content }),
        });
        if (!res.ok) throw new Error('Failed to update file content');
      }

      showToast('File saved successfully');
      setEditorData((prev) => ({ ...prev, isOpen: false, isSaving: false }));
      fetchData();
      fetchStorage();
    } catch (err: any) {
      alert(err.message || 'Error saving file');
      setEditorData((prev) => ({ ...prev, isSaving: false }));
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !renameValue.trim()) return;
    try {
      const res = await fetch(`/api/items/${renameTarget.type}/${renameTarget.id}/rename`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      if (!res.ok) throw new Error('Rename failed');
      setRenameTarget(null);
      showToast('Renamed successfully');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCopyLink = async (fileId: string) => {
    try {
      const res = await fetch(`/api/files/${fileId}/url`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await navigator.clipboard.writeText(data.url);
      showToast('Public signed link copied');
    } catch {
      alert('Could not copy link');
    }
  };

  const handleDownloadZip = async () => {
    if (selectedFileIds.length === 0) return;
    setIsDownloadingZip(true);
    try {
      const zip = new JSZip();
      const filesToDownload = files.filter((f) => selectedFileIds.includes(f.id));

      for (const file of filesToDownload) {
        const res = await fetch(`/api/files/${file.id}/url`, { credentials: 'include' });
        if (!res.ok) continue;
        const { url } = await res.json();
        const fileBlob = await fetch(url).then((r) => r.blob());
        zip.file(file.name, fileBlob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `bundle-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
      showToast('Archive downloaded');
    } catch (err: any) {
      alert(err.message || 'ZIP failed');
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handlePreview = async (file: FileItem) => {
    try {
      const res = await fetch(`/api/files/${file.id}/url`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreviewData({ url: data.url, name: file.name, mime: file.mime_type });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const isEditableFile = (fileName: string, mime: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const codeExtensions = [
      'js', 'jsx', 'ts', 'tsx', 'py', 'html', 'css', 'scss', 'json', 'md',
      'txt', 'sql', 'java', 'c', 'cpp', 'go', 'rs', 'php', 'rb', 'sh', 'yaml', 'xml'
    ];
    return codeExtensions.includes(ext) || mime.includes('text') || mime.includes('json');
  };

  const renderFileIcon = (fileName: string, mime: string, sizeClass = 'h-4 w-4') => {
    if (isEditableFile(fileName, mime)) return <Code2 className={`${sizeClass} text-sky-500`} />;
    if (mime.startsWith('image/')) return <Eye className={`${sizeClass} text-emerald-500`} />;
    if (mime.startsWith('video/')) return <Video className={`${sizeClass} text-indigo-500`} />;
    if (mime.startsWith('audio/')) return <Music className={`${sizeClass} text-amber-500`} />;
    if (mime.includes('pdf') || mime.includes('document')) return <FileText className={`${sizeClass} text-blue-500`} />;
    return <FileCode className={`${sizeClass} text-slate-400`} />;
  };

  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const storagePercentage = Math.min(100, (storageUsed / (storageLimit || 1)) * 100);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) processUpload(e.dataTransfer.files);
      }}
      className={`flex h-screen font-sans antialiased transition-colors duration-200 select-none ${
        darkMode ? 'bg-[#080B11] text-slate-100' : 'bg-[#F8FAFC] text-slate-900'
      }`}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/90 dark:bg-white/95 dark:text-slate-900 text-white backdrop-blur-md px-4 py-3 rounded-2xl shadow-2xl text-xs font-semibold tracking-wide flex items-center gap-2 border border-slate-700/40">
          <Check className="h-4 w-4 text-emerald-400 dark:text-emerald-600" />
          {toastMessage}
        </div>
      )}

      {/* Uploading Status */}
      {uploading && (
        <div className="fixed bottom-6 left-6 z-50 bg-blue-600/95 backdrop-blur-md text-white px-5 py-3.5 rounded-2xl shadow-2xl text-xs font-semibold flex items-center gap-3 animate-pulse border border-blue-400/30">
          <UploadCloud className="h-4 w-4" />
          {uploadProgress || 'Processing upload stream...'}
        </div>
      )}

      {/* Fullscreen Drag Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-blue-600/10 backdrop-blur-md border-2 border-dashed border-blue-500 flex flex-col items-center justify-center pointer-events-none">
          <UploadCloud className="h-16 w-16 text-blue-600 dark:text-blue-400 animate-bounce mb-3" />
          <h2 className="text-xl font-bold tracking-tight text-blue-700 dark:text-blue-300">
            Drop assets here to ingest
          </h2>
        </div>
      )}

      {/* Floating Multi-Selection Action Deck */}
      {selectedFileIds.length > 0 && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 bg-slate-900/90 dark:bg-slate-800/90 text-white backdrop-blur-md px-5 py-2.5 rounded-2xl shadow-2xl border border-slate-700/50 flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
          <span className="text-xs font-bold tracking-wide">
            {selectedFileIds.length} {selectedFileIds.length === 1 ? 'asset' : 'assets'} selected
          </span>
          <div className="h-4 w-[1px] bg-slate-700" />
          <button
            onClick={handleDownloadZip}
            disabled={isDownloadingZip}
            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
          >
            <Archive className="h-3.5 w-3.5" /> Export (.ZIP)
          </button>
          <button
            onClick={handleBatchDelete}
            className="flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" /> Move to Trash
          </button>
          <button
            onClick={() => setSelectedFileIds([])}
            className="text-xs font-medium text-slate-400 hover:text-white ml-2"
          >
            Deselect
          </button>
        </div>
      )}

      {/* Left Navigation Console */}
      <aside
        className={`w-64 border-r flex flex-col justify-between p-5 transition-colors shrink-0 ${
          darkMode ? 'bg-[#0D111A] border-slate-800/80' : 'bg-white border-slate-200/80'
        }`}
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <HardDrive className="h-4 w-4" />
              </div>
              <div>
                <span className="font-bold text-sm tracking-tight block">Cloud Space</span>
                <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">Monaco Pro</span>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-xl transition border ${
                darkMode
                  ? 'bg-slate-800/60 border-slate-700 text-amber-400 hover:bg-slate-800'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => {
                setCurrentFolderId(null);
                setSearchQuery('');
                setIsStarredView(false);
                setSelectedCategory('all');
              }}
              className={`flex items-center gap-3 w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl transition ${
                !isStarredView ? (darkMode ? 'bg-blue-600/15 text-blue-400' : 'bg-blue-50 text-blue-700') : 'text-slate-400 hover:bg-slate-850'
              }`}
            >
              <Folder className="h-4 w-4" /> Storage Vault
            </button>
            <button
              onClick={() => {
                setIsStarredView(true);
                setCurrentFolderId(null);
              }}
              className={`flex items-center gap-3 w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl transition ${
                isStarredView ? (darkMode ? 'bg-amber-600/15 text-amber-400' : 'bg-amber-50 text-amber-700') : 'text-slate-400 hover:bg-slate-850'
              }`}
            >
              <Star className="h-4 w-4 text-amber-500" /> Starred Items
            </button>
            <button
              onClick={() => router.push('/trash')}
              className={`flex items-center gap-3 w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl transition ${
                darkMode ? 'text-slate-400 hover:bg-slate-850' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Trash2 className="h-4 w-4" /> Recycle Bin
            </button>
            <button
              onClick={() => setIsAnalyticsOpen(true)}
              className={`flex items-center gap-3 w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl transition ${
                darkMode ? 'text-slate-400 hover:bg-slate-850' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <PieChart className="h-4 w-4 text-emerald-500" /> Storage Breakdown
            </button>
          </nav>
        </div>

        {/* Quota Gauge */}
        <div className={`border-t pt-5 space-y-3.5 ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="space-y-1.5">
            <div className={`flex justify-between text-[11px] font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              <span className="flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5" /> Storage Capacity
              </span>
              <span>
                {formatSize(storageUsed)} / {formatSize(storageLimit)}
              </span>
            </div>
            <div className={`w-full rounded-full h-1.5 overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  storagePercentage > 85 ? 'bg-red-500' : storagePercentage > 60 ? 'bg-amber-500' : 'bg-blue-600'
                }`}
                style={{ width: `${storagePercentage}%` }}
              />
            </div>
          </div>
          <button
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
              router.push('/login');
            }}
            className={`flex items-center gap-2 text-xs font-semibold w-full px-3 py-2.5 rounded-xl transition ${
              darkMode ? 'text-slate-400 hover:text-red-400 hover:bg-slate-850' : 'text-slate-600 hover:text-red-600 hover:bg-slate-50'
            }`}
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Orchestration Canvas */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Control Bar */}
        <header
          className={`h-16 border-b flex items-center justify-between px-6 transition-colors shrink-0 ${
            darkMode ? 'bg-[#0D111A] border-slate-800/80' : 'bg-white border-slate-200/80'
          }`}
        >
          <div className="relative w-80">
            <Search className={`absolute left-3 top-2.5 h-4 w-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              type="text"
              placeholder="Search resources, directories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-4 py-2 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                darkMode
                  ? 'bg-slate-950/60 border-slate-800 text-slate-100 placeholder-slate-500'
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            />
          </div>

          <div className="flex items-center gap-2.5">
            {/* View Switcher */}
            <div className={`flex items-center rounded-xl p-1 border ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'table' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Tabular View"
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'grid' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Matrix View"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </div>

            <button
              onClick={handleCreateNewFile}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition border ${
                darkMode
                  ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-200'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <Code2 className="h-3.5 w-3.5 text-sky-500" /> New Code/Doc
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files && processUpload(e.target.files)}
              multiple
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 transition disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" /> {uploading ? 'Uploading...' : 'Upload'}
            </button>
            <button
              onClick={() => setIsNewFolderOpen(true)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition border ${
                darkMode
                  ? 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-200'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <FolderPlus className="h-3.5 w-3.5" /> New Directory
            </button>
          </div>
        </header>

        {/* Content Viewport */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Breadcrumbs & Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className={`flex items-center gap-1.5 text-xs font-medium ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={crumb.id || 'root'}>
                  <button onClick={() => setCurrentFolderId(crumb.id)} className="hover:text-blue-500">
                    {crumb.name}
                  </button>
                  {idx < breadcrumbs.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                </React.Fragment>
              ))}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {(['all', 'code', 'image', 'video', 'audio', 'document'] as FilterCategory[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1 rounded-full text-[11px] font-semibold capitalize transition ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white shadow-xs'
                      : darkMode
                      ? 'bg-[#0D111A] border border-slate-800 text-slate-400 hover:bg-slate-850'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Folders */}
          {folders.length > 0 && selectedCategory === 'all' && (
            <div className="space-y-3">
              <h3 className={`text-[11px] font-bold uppercase tracking-wider ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Directories
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    onClick={() => setCurrentFolderId(folder.id)}
                    className={`flex items-center justify-between p-3.5 border rounded-2xl shadow-2xs cursor-pointer group transition ${
                      darkMode ? 'bg-[#0D111A] border-slate-800 hover:border-blue-500' : 'bg-white border-slate-200/80 hover:border-blue-400'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <Folder className="h-4 w-4 text-amber-500 shrink-0" />
                      <span className="text-xs font-semibold truncate">{folder.name}</span>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStar('folder', folder.id, folder.is_starred);
                        }}
                        className="p-1 text-slate-400 hover:text-amber-500"
                        title="Star"
                      >
                        <Star className={`h-3 w-3 ${folder.is_starred ? 'text-amber-500 fill-amber-500' : ''}`} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenameTarget({ type: 'folder', id: folder.id, name: folder.name });
                          setRenameValue(folder.name);
                        }}
                        className="p-1 text-slate-400 hover:text-blue-500"
                      >
                        <Edit3 className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Move directory to trash?')) deleteItem('folder', folder.id);
                        }}
                        className="p-1 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Files List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className={`text-[11px] font-bold uppercase tracking-wider ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Assets ({processedFiles.length})
              </h3>
              {processedFiles.length > 0 && (
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    <select
                      value={sortField}
                      onChange={(e: any) => setSortField(e.target.value)}
                      className={`bg-transparent text-xs font-medium focus:outline-none ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}
                    >
                      <option value="created_at">Date Added</option>
                      <option value="name">Alphabetical</option>
                      <option value="size_bytes">Storage Size</option>
                    </select>
                    <button
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="font-bold text-[10px] uppercase px-1 text-blue-500"
                    >
                      {sortOrder}
                    </button>
                  </div>

                  <button
                    onClick={() =>
                      setSelectedFileIds(selectedFileIds.length === processedFiles.length ? [] : processedFiles.map((f) => f.id))
                    }
                    className="text-slate-400 hover:text-slate-200 text-xs font-semibold flex items-center gap-1.5"
                  >
                    {selectedFileIds.length === processedFiles.length ? (
                      <CheckSquare className="h-3.5 w-3.5 text-blue-500" />
                    ) : (
                      <Square className="h-3.5 w-3.5" />
                    )}
                    Select All
                  </button>
                </div>
              )}
            </div>

            {processedFiles.length === 0 ? (
              <div
                className={`text-center py-20 border-2 border-dashed rounded-2xl ${
                  darkMode ? 'bg-[#0D111A]/40 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <UploadCloud className="h-10 w-10 text-slate-400 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-semibold text-slate-400">No assets detected in this path</p>
              </div>
            ) : viewMode === 'table' ? (
              /* Table Layout */
              <div
                className={`border rounded-2xl overflow-hidden shadow-2xs ${
                  darkMode ? 'bg-[#0D111A] border-slate-800/80' : 'bg-white border-slate-200/80'
                }`}
              >
                <table className="w-full text-left text-xs">
                  <thead
                    className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                      darkMode ? 'bg-slate-950/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    <tr>
                      <th className="py-3 px-4 w-10"></th>
                      <th className="py-3 px-4">Resource Identifier</th>
                      <th className="py-3 px-4">Storage Footprint</th>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${darkMode ? 'divide-slate-800/60' : 'divide-slate-100'}`}>
                    {processedFiles.map((file) => {
                      const isSelected = selectedFileIds.includes(file.id);
                      const editable = isEditableFile(file.name, file.mime_type);
                      return (
                        <tr
                          key={file.id}
                          onClick={() => setActiveInspectorItem(file)}
                          className={`cursor-pointer transition ${
                            isSelected
                              ? darkMode
                                ? 'bg-blue-600/15'
                                : 'bg-blue-50/70'
                              : darkMode
                              ? 'hover:bg-slate-850/50'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() =>
                                setSelectedFileIds((prev) =>
                                  prev.includes(file.id) ? prev.filter((i) => i !== file.id) : [...prev, file.id]
                                )
                              }
                              className="text-slate-400 hover:text-blue-500"
                            >
                              {isSelected ? <CheckSquare className="h-4 w-4 text-blue-500" /> : <Square className="h-4 w-4" />}
                            </button>
                          </td>
                          <td className="py-3 px-4 flex items-center gap-3 font-semibold">
                            {renderFileIcon(file.name, file.mime_type)}
                            <span className="truncate max-w-xs">{file.name}</span>
                          </td>
                          <td className={`py-3 px-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {formatSize(file.size_bytes)}
                          </td>
                          <td className={`py-3 px-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {new Date(file.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              {editable && (
                                <button
                                  onClick={() => handleOpenMonaco(file)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                  title="Edit in Monaco"
                                >
                                  <Code2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => toggleStar('file', file.id, file.is_starred)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Star"
                              >
                                <Star className={`h-3.5 w-3.5 ${file.is_starred ? 'text-amber-500 fill-amber-500' : ''}`} />
                              </button>
                              <button
                                onClick={() => handlePreview(file)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Quick Look"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleCopyLink(file.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Copy Link"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setRenameTarget({ type: 'file', id: file.id, name: file.name });
                                  setRenameValue(file.name);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Rename"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setShareFileId(file.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Permissions"
                              >
                                <Share2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('Move asset to trash?')) deleteItem('file', file.id);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Trash"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Grid Layout */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                {processedFiles.map((file) => {
                  const isSelected = selectedFileIds.includes(file.id);
                  const editable = isEditableFile(file.name, file.mime_type);
                  return (
                    <div
                      key={file.id}
                      onClick={() => setActiveInspectorItem(file)}
                      className={`relative border rounded-2xl p-3 flex flex-col justify-between transition group cursor-pointer shadow-2xs ${
                        isSelected
                          ? darkMode
                            ? 'border-blue-500 bg-blue-600/10'
                            : 'border-blue-500 bg-blue-50/50'
                          : darkMode
                          ? 'border-slate-800 bg-[#0D111A] hover:border-slate-700'
                          : 'border-slate-200 bg-white hover:border-blue-300'
                      }`}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFileIds((prev) =>
                            prev.includes(file.id) ? prev.filter((i) => i !== file.id) : [...prev, file.id]
                          );
                        }}
                        className="absolute top-3 left-3 text-slate-400 hover:text-blue-500 z-10"
                      >
                        {isSelected ? <CheckSquare className="h-4 w-4 text-blue-500" /> : <Square className="h-4 w-4" />}
                      </button>

                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (editable) handleOpenMonaco(file);
                          else handlePreview(file);
                        }}
                        className={`h-24 flex items-center justify-center my-2 rounded-xl transition ${
                          darkMode ? 'bg-slate-950/60' : 'bg-slate-50'
                        }`}
                      >
                        {renderFileIcon(file.name, file.mime_type, 'h-8 w-8')}
                      </div>

                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold truncate" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-[10px] font-medium text-slate-400">{formatSize(file.size_bytes)}</p>
                      </div>

                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 dark:border-slate-800"
                      >
                        {editable ? (
                          <button
                            onClick={() => handleOpenMonaco(file)}
                            className="text-slate-400 hover:text-sky-500"
                            title="Edit in Monaco"
                          >
                            <Code2 className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => toggleStar('file', file.id, file.is_starred)}
                            className="text-slate-400 hover:text-amber-500"
                          >
                            <Star className={`h-3.5 w-3.5 ${file.is_starred ? 'text-amber-500 fill-amber-500' : ''}`} />
                          </button>
                        )}
                        <button onClick={() => handleCopyLink(file.id)} className="text-slate-400 hover:text-emerald-500">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setRenameTarget({ type: 'file', id: file.id, name: file.name });
                            setRenameValue(file.name);
                          }}
                          className="text-slate-400 hover:text-amber-500"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setShareFileId(file.id)} className="text-slate-400 hover:text-indigo-500">
                          <Share2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Move asset to trash?')) deleteItem('file', file.id);
                          }}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Slide-out Inspector Drawer */}
      {activeInspectorItem && (
        <aside
          className={`w-80 border-l p-5 flex flex-col justify-between overflow-y-auto transition-colors shrink-0 ${
            darkMode ? 'bg-[#0D111A] border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-blue-500">
                <Info className="h-4 w-4" /> Asset Metadata
              </span>
              <button onClick={() => setActiveInspectorItem(null)} className="text-slate-400 hover:text-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className={`p-5 rounded-2xl flex items-center justify-center ${darkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
              {renderFileIcon(activeInspectorItem.name, activeInspectorItem.mime_type, 'h-12 w-12')}
            </div>

            <div className="space-y-1">
              <h4 className="font-semibold text-xs break-all">{activeInspectorItem.name}</h4>
              <p className="text-[11px] text-slate-400">{activeInspectorItem.mime_type}</p>
            </div>

            <div className={`divide-y text-xs ${darkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">File Payload</span>
                <span className="font-semibold">{formatSize(activeInspectorItem.size_bytes)}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Date Generated</span>
                <span className="font-semibold">{new Date(activeInspectorItem.created_at).toLocaleDateString()}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Storage Location</span>
                <span className="font-mono text-[10px] truncate max-w-[120px]">{activeInspectorItem.storage_key}</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              {isEditableFile(activeInspectorItem.name, activeInspectorItem.mime_type) ? (
                <button
                  onClick={() => handleOpenMonaco(activeInspectorItem)}
                  className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white py-2.5 rounded-xl text-xs font-semibold shadow-xs"
                >
                  <Code2 className="h-3.5 w-3.5" /> Edit in Monaco
                </button>
              ) : (
                <button
                  onClick={() => handlePreview(activeInspectorItem)}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-xs font-semibold shadow-xs"
                >
                  <Eye className="h-3.5 w-3.5" /> Instant Preview
                </button>
              )}
              <button
                onClick={() => handleCopyLink(activeInspectorItem.id)}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold border ${
                  darkMode ? 'bg-slate-850 border-slate-700 hover:bg-slate-800' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <ExternalLink className="h-3.5 w-3.5" /> Copy Signed Link
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Monaco Editor Full-Screen IDE Modal */}
      {editorData.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div
            className={`rounded-3xl max-w-5xl w-full h-[90vh] flex flex-col shadow-2xl border overflow-hidden ${
              darkMode ? 'bg-[#0D111A] border-slate-800 text-slate-100' : 'bg-white border-slate-200'
            }`}
          >
            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800/80 shrink-0">
              <div className="flex items-center gap-3">
                <Code2 className="h-5 w-5 text-sky-500" />
                <input
                  type="text"
                  value={editorData.fileName}
                  onChange={(e) => setEditorData((prev) => ({ ...prev, fileName: e.target.value }))}
                  placeholder="script.js"
                  className={`font-mono text-xs px-2.5 py-1 rounded-xl border focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    darkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-300'
                  }`}
                />
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-blue-600/20 text-blue-400 font-bold uppercase">
                  {getLanguageFromFileName(editorData.fileName)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditorData((prev) => ({ ...prev, isOpen: false }))}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-xl text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveMonaco}
                  disabled={editorData.isSaving}
                  className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs disabled:opacity-50"
                >
                  {editorData.isSaving ? 'Saving...' : 'Save File'}
                </button>
              </div>
            </div>

            {/* Monaco Canvas */}
            <div className="flex-1 w-full overflow-hidden">
              <Editor
                height="100%"
                language={getLanguageFromFileName(editorData.fileName)}
                value={editorData.content}
                theme={darkMode ? 'vs-dark' : 'light'}
                onChange={(val) => setEditorData((prev) => ({ ...prev, content: val || '' }))}
                options={{
                  minimap: { enabled: true },
                  fontSize: 13,
                  lineNumbers: 'on',
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Analytics Modal */}
      {isAnalyticsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div
            className={`rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl border ${
              darkMode ? 'bg-[#0D111A] border-slate-800 text-slate-100' : 'bg-white border-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <PieChart className="h-4 w-4 text-emerald-500" /> Quota Breakdown
              </h3>
              <button onClick={() => setIsAnalyticsOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>Images</span>
                  <span>{formatSize(storageBreakdown.images)}</span>
                </div>
                <div className="w-full bg-slate-800/50 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full"
                    style={{ width: `${Math.min(100, (storageBreakdown.images / (storageLimit || 1)) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>Videos</span>
                  <span>{formatSize(storageBreakdown.videos)}</span>
                </div>
                <div className="w-full bg-slate-800/50 rounded-full h-2">
                  <div
                    className="bg-indigo-500 h-2 rounded-full"
                    style={{ width: `${Math.min(100, (storageBreakdown.videos / (storageLimit || 1)) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>Documents & Code</span>
                  <span>{formatSize(storageBreakdown.documents)}</span>
                </div>
                <div className="w-full bg-slate-800/50 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${Math.min(100, (storageBreakdown.documents / (storageLimit || 1)) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>Audio & Others</span>
                  <span>{formatSize(storageBreakdown.audio + storageBreakdown.others)}</span>
                </div>
                <div className="w-full bg-slate-800/50 rounded-full h-2">
                  <div
                    className="bg-amber-500 h-2 rounded-full"
                    style={{
                      width: `${Math.min(100, ((storageBreakdown.audio + storageBreakdown.others) / (storageLimit || 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setIsAnalyticsOpen(false)}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {isNewFolderOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newFolderName.trim()) return;
              await fetch('/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name: newFolderName.trim(), parent_id: currentFolderId }),
              });
              setNewFolderName('');
              setIsNewFolderOpen(false);
              fetchData();
            }}
            className={`rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl border ${
              darkMode ? 'bg-[#0D111A] border-slate-800 text-slate-100' : 'bg-white border-slate-100'
            }`}
          >
            <h3 className="font-semibold text-sm">Create New Directory</h3>
            <input
              type="text"
              autoFocus
              placeholder="Directory name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className={`w-full px-3.5 py-2 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                darkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-300'
              }`}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewFolderOpen(false)}
                className="px-3.5 py-2 text-xs text-slate-400 hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl">
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rename Modal */}
      {renameTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleRenameSubmit}
            className={`rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl border ${
              darkMode ? 'bg-[#0D111A] border-slate-800 text-slate-100' : 'bg-white border-slate-100'
            }`}
          >
            <h3 className="font-semibold text-sm">Rename Resource</h3>
            <input
              type="text"
              autoFocus
              required
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className={`w-full px-3.5 py-2 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                darkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-300'
              }`}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="px-3.5 py-2 text-xs text-slate-400 hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl">
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Share Modal */}
      {shareFileId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!shareFileId || !shareEmail.trim()) return;
              setSharing(true);
              try {
                const res = await fetch('/api/shares', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ file_id: shareFileId, email: shareEmail.trim(), role: shareRole }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Share failed');
                showToast('Permissions delegated successfully');
                setShareFileId(null);
                setShareEmail('');
              } catch (err: any) {
                alert(err.message);
              } finally {
                setSharing(false);
              }
            }}
            className={`rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl border ${
              darkMode ? 'bg-[#0D111A] border-slate-800 text-slate-100' : 'bg-white border-slate-100'
            }`}
          >
            <h3 className="font-semibold text-sm">Delegate Asset Access</h3>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Collaborator Email</label>
              <input
                type="email"
                required
                placeholder="colleague@enterprise.com"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                className={`w-full px-3.5 py-2 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  darkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-300'
                }`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Access Role</label>
              <select
                value={shareRole}
                onChange={(e: any) => setShareRole(e.target.value)}
                className={`w-full px-3.5 py-2 border rounded-xl text-xs ${
                  darkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-300'
                }`}
              >
                <option value="viewer">Viewer (Read Only)</option>
                <option value="editor">Editor (Read & Write)</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShareFileId(null)}
                className="px-3.5 py-2 text-xs text-slate-400 hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sharing}
                className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl disabled:opacity-50"
              >
                {sharing ? 'Assigning...' : 'Grant Access'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Preview Modal */}
      {previewData && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 z-50">
          <div className="bg-[#0D111A] border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800">
              <h4 className="font-semibold text-xs text-slate-200 truncate">{previewData.name}</h4>
              <button onClick={() => setPreviewData(null)} className="text-slate-400 hover:text-slate-200 text-sm">
                ✕
              </button>
            </div>
            <div className="p-4 flex-1 flex items-center justify-center bg-black overflow-auto">
              {previewData.mime.startsWith('image/') && (
                <img src={previewData.url} alt={previewData.name} className="max-h-[70vh] max-w-full object-contain rounded-2xl" />
              )}
              {previewData.mime.startsWith('video/') && (
                <video controls autoPlay className="max-h-[70vh] max-w-full rounded-2xl">
                  <source src={previewData.url} type={previewData.mime} />
                </video>
              )}
              {previewData.mime.startsWith('audio/') && (
                <div className="p-8 w-full max-w-md bg-slate-900 rounded-2xl flex flex-col items-center">
                  <Music className="h-12 w-12 text-blue-500 mb-4 animate-pulse" />
                  <audio controls className="w-full">
                    <source src={previewData.url} type={previewData.mime} />
                  </audio>
                </div>
              )}
              {previewData.mime.includes('pdf') && (
                <iframe src={previewData.url} className="w-full h-[70vh] rounded-2xl" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}