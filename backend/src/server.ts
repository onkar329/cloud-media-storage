import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import ws from 'ws';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 8000);
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key';
const BUCKET = process.env.SUPABASE_BUCKET || 'Drive';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    realtime: {
      transport: ws,
    },
  }
);

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: 'http://localhost:3000',
    credentials: true,
  })
);

export interface AuthedRequest extends Request {
  user?: { id: string; email: string };
}

export function auth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: { message: 'Unauthorized' } });

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: { message: 'Invalid or expired session' } });
  }
}

async function getBreadcrumbs(folderId: string | null, userId: string) {
  const crumbs: Array<{ id: string; name: string }> = [];
  let currentId = folderId;

  while (currentId) {
    const { data: folder } = await supabase
      .from('folders')
      .select('id, name, parent_id')
      .eq('id', currentId)
      .eq('owner_id', userId)
      .maybeSingle();

    if (!folder) break;
    crumbs.unshift({ id: folder.id, name: folder.name });
    currentId = folder.parent_id;
  }
  return crumbs;
}

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

// --- Authentication ---
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: { message: 'Valid email and 8+ char password required' } });
  }

  const { data: existing } = await supabase.from('users').select('id').eq('email', email.trim().toLowerCase()).maybeSingle();
  if (existing) return res.status(400).json({ error: { message: 'Email is already registered' } });

  const password_hash = await bcrypt.hash(password, 10);
  const { data: user, error } = await supabase
    .from('users')
    .insert({ email: email.trim().toLowerCase(), name, password_hash })
    .select()
    .single();

  if (error) return res.status(500).json({ error: { message: error.message } });

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', path: '/' });
  res.json({ user: { id: user.id, email: user.email, name: user.name } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const { data: user } = await supabase.from('users').select('*').eq('email', email.trim().toLowerCase()).maybeSingle();

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: { message: 'Invalid email or password' } });
  }

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', path: '/' });
  res.json({ user: { id: user.id, email: user.email, name: user.name } });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// --- Profile & Settings ---
app.get('/api/auth/me', auth, async (req: AuthedRequest, res) => {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, name, created_at')
    .eq('id', req.user!.id)
    .single();

  if (error) return res.status(500).json({ error: { message: error.message } });
  res.json(user);
});

app.patch('/api/auth/profile', auth, async (req: AuthedRequest, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: { message: 'Name cannot be empty' } });

  const { data, error } = await supabase
    .from('users')
    .update({ name: name.trim() })
    .eq('id', req.user!.id)
    .select('id, email, name')
    .single();

  if (error) return res.status(500).json({ error: { message: error.message } });
  res.json({ success: true, user: data });
});

app.patch('/api/auth/password', auth, async (req: AuthedRequest, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: { message: 'New password must be at least 8 characters' } });
  }

  const { data: user } = await supabase.from('users').select('password_hash').eq('id', req.user!.id).single();
  if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
    return res.status(401).json({ error: { message: 'Incorrect current password' } });
  }

  const password_hash = await bcrypt.hash(newPassword, 10);
  const { error } = await supabase.from('users').update({ password_hash }).eq('id', req.user!.id);
  if (error) return res.status(500).json({ error: { message: error.message } });

  res.json({ success: true });
});

// --- Storage Quota Usage ---
app.get('/api/storage/usage', auth, async (req: AuthedRequest, res) => {
  const { data, error } = await supabase
    .from('files')
    .select('size_bytes')
    .eq('owner_id', req.user!.id)
    .eq('is_deleted', false);

  if (error) return res.status(500).json({ error: { message: error.message } });

  const totalBytes = (data || []).reduce((sum, item) => sum + Number(item.size_bytes || 0), 0);
  const limitBytes = 100 * 1024 * 1024; // 100 MB Limit

  res.json({
    usedBytes: totalBytes,
    limitBytes,
    usedMB: (totalBytes / (1024 * 1024)).toFixed(2),
    limitMB: (limitBytes / (1024 * 1024)).toFixed(0),
    percentage: Math.min(100, (totalBytes / limitBytes) * 100).toFixed(1),
  });
});

// --- Folders ---
app.get('/api/folders', auth, async (req: AuthedRequest, res) => {
  const sortBy = String(req.query.sortBy || 'created_at');
  const order = req.query.order === 'asc';

  const [folders, files] = await Promise.all([
    supabase
      .from('folders')
      .select('*')
      .eq('owner_id', req.user!.id)
      .is('parent_id', null)
      .eq('is_deleted', false)
      .order('name', { ascending: true }),
    supabase
      .from('files')
      .select('*')
      .eq('owner_id', req.user!.id)
      .is('folder_id', null)
      .eq('is_deleted', false)
      .order(sortBy, { ascending: order }),
  ]);

  if (folders.error) return res.status(400).json({ error: { message: folders.error.message } });
  if (files.error) return res.status(400).json({ error: { message: files.error.message } });

  res.json({ breadcrumbs: [], folders: folders.data || [], files: files.data || [] });
});

app.get('/api/folders/:id', auth, async (req: AuthedRequest, res) => {
  const sortBy = String(req.query.sortBy || 'created_at');
  const order = req.query.order === 'asc';

  const { data: folder } = await supabase
    .from('folders')
    .select('*')
    .eq('id', req.params.id)
    .eq('owner_id', req.user!.id)
    .maybeSingle();

  if (!folder) return res.status(404).json({ error: { message: 'Folder not found' } });

  const [folders, files, breadcrumbs] = await Promise.all([
    supabase
      .from('folders')
      .select('*')
      .eq('parent_id', folder.id)
      .eq('is_deleted', false)
      .order('name', { ascending: true }),
    supabase
      .from('files')
      .select('*')
      .eq('folder_id', folder.id)
      .eq('is_deleted', false)
      .order(sortBy, { ascending: order }),
    getBreadcrumbs(folder.id, req.user!.id),
  ]);

  res.json({
    folder,
    breadcrumbs,
    children: {
      folders: folders.data || [],
      files: files.data || [],
    },
  });
});

app.post('/api/folders', auth, async (req: AuthedRequest, res) => {
  const { name, parentId } = req.body;
  const { data, error } = await supabase
    .from('folders')
    .insert({ name, parent_id: parentId || null, owner_id: req.user!.id })
    .select()
    .single();

  if (error) return res.status(500).json({ error: { message: error.message } });
  res.json(data);
});

// --- Files ---
app.post('/api/files/init', auth, async (req: AuthedRequest, res) => {
  const { name, mimeType, sizeBytes, folderId } = req.body;
  const key = `tenants/${req.user!.id}/files/${Date.now()}-${name}`;

  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(key);

  if (signErr) return res.status(500).json({ error: { message: signErr.message } });

  const { data: file, error: dbErr } = await supabase
    .from('files')
    .insert({
      name,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      storage_key: key,
      owner_id: req.user!.id,
      folder_id: folderId || null,
      is_deleted: true,
    })
    .select()
    .single();

  if (dbErr) return res.status(500).json({ error: { message: dbErr.message } });
  res.json({ uploadUrl: signed.signedUrl, fileId: file.id });
});

app.post('/api/files/complete', auth, async (req: AuthedRequest, res) => {
  const { fileId } = req.body;
  const { error } = await supabase
    .from('files')
    .update({ is_deleted: false })
    .eq('id', fileId)
    .eq('owner_id', req.user!.id);

  if (error) return res.status(500).json({ error: { message: error.message } });
  res.json({ ok: true });
});

app.get('/api/files/:id', auth, async (req: AuthedRequest, res) => {
  const { data: file } = await supabase
    .from('files')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (!file) return res.status(404).json({ error: { message: 'File not found' } });

  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(file.storage_key, 3600);
  res.json({ ...file, signedUrl: signed?.signedUrl });
});

app.post('/api/files/:id/share', auth, async (req: AuthedRequest, res) => {
  const { expiresIn = 86400 } = req.body;
  const { data: file } = await supabase
    .from('files')
    .select('*')
    .eq('id', req.params.id)
    .eq('owner_id', req.user!.id)
    .single();

  if (!file) return res.status(404).json({ error: { message: 'File not found' } });

  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(file.storage_key, Number(expiresIn));
  res.json({ shareUrl: signed?.signedUrl, name: file.name });
});

app.patch('/api/files/:id', auth, async (req: AuthedRequest, res) => {
  const { name } = req.body;
  const { data, error } = await supabase
    .from('files')
    .update({ name })
    .eq('id', req.params.id)
    .eq('owner_id', req.user!.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: { message: error.message } });
  res.json(data);
});

app.delete('/api/files/:id', auth, async (req: AuthedRequest, res) => {
  const { error } = await supabase
    .from('files')
    .update({ is_deleted: true })
    .eq('id', req.params.id)
    .eq('owner_id', req.user!.id);

  if (error) return res.status(500).json({ error: { message: error.message } });
  res.json({ ok: true });
});

app.post('/api/files/bulk-delete', auth, async (req: AuthedRequest, res) => {
  const { fileIds = [] } = req.body;
  const { error } = await supabase
    .from('files')
    .update({ is_deleted: true })
    .in('id', fileIds)
    .eq('owner_id', req.user!.id);

  if (error) return res.status(500).json({ error: { message: error.message } });
  res.json({ success: true, count: fileIds.length });
});

// --- Trash ---
app.get('/api/trash', auth, async (req: AuthedRequest, res) => {
  const { data: items, error } = await supabase
    .from('files')
    .select('*')
    .eq('owner_id', req.user!.id)
    .eq('is_deleted', true)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: { message: error.message } });
  res.json({ items: items || [] });
});

app.delete('/api/trash/:id', auth, async (req: AuthedRequest, res) => {
  const { data: file } = await supabase
    .from('files')
    .select('*')
    .eq('id', req.params.id)
    .eq('owner_id', req.user!.id)
    .single();

  if (!file) return res.status(404).json({ error: { message: 'File not found' } });

  await supabase.storage.from(BUCKET).remove([file.storage_key]);
  await supabase.from('files').delete().eq('id', req.params.id);
  res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => console.log(`API running on http://127.0.0.1:${PORT}`));