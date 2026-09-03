import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from './supabase';
import { authenticateToken, AuthRequest } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-12345';
const BUCKET_NAME = process.env.SUPABASE_BUCKET || 'Drive';

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Cloud Media Storage API online' });
});

// ================= AUTHENTICATION & PROFILE =================

app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'User already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{ email, password_hash, name: name || email.split('@')[0] }])
      .select('id, email, name')
      .single();

    if (error || !newUser) {
      return res.status(500).json({ error: error?.message || 'Failed to create user' });
    }

    const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({ user: newUser, token });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      user: { id: user.id, email: user.email, name: user.name },
      token,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', (_req: Request, res: Response) => {
  res.clearCookie('token');
  return res.json({ message: 'Logged out successfully' });
});

app.get('/api/auth/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, created_at')
      .eq('id', req.user?.id)
      .single();

    if (error || !user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/auth/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { name, currentPassword, newPassword } = req.body;

    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userErr || !user) return res.status(404).json({ error: 'User not found' });

    const updates: Record<string, any> = {};
    if (name && name.trim()) updates.name = name.trim();

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required' });
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isMatch) {
        return res.status(400).json({ error: 'Current password does not match' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      updates.password_hash = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { data: updatedUser, error: updateErr } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select('id, email, name, created_at')
      .single();

    if (updateErr) throw updateErr;
    return res.json({ message: 'Profile updated', user: updatedUser });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ================= DRIVE STORAGE, FILES & FOLDERS =================

app.get('/api/drive', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const folderId = req.query.folderId ? String(req.query.folderId) : null;
    const search = req.query.search ? String(req.query.search).trim() : '';
    const starredOnly = req.query.starred === 'true';

    let folderQuery = supabase
      .from('folders')
      .select('*')
      .eq('owner_id', userId)
      .eq('is_deleted', false);

    let fileQuery = supabase
      .from('files')
      .select('*')
      .eq('owner_id', userId)
      .eq('is_deleted', false);

    if (starredOnly) {
      folderQuery = folderQuery.eq('is_starred', true);
      fileQuery = fileQuery.eq('is_starred', true);
    } else if (search) {
      folderQuery = folderQuery.ilike('name', `%${search}%`);
      fileQuery = fileQuery.ilike('name', `%${search}%`);
    } else {
      if (folderId) {
        folderQuery = folderQuery.eq('parent_id', folderId);
        fileQuery = fileQuery.eq('folder_id', folderId);
      } else {
        folderQuery = folderQuery.is('parent_id', null);
        fileQuery = fileQuery.is('folder_id', null);
      }
    }

    const [{ data: folders }, { data: files }] = await Promise.all([
      folderQuery.order('name', { ascending: true }),
      fileQuery.order('created_at', { ascending: false }),
    ]);

    const breadcrumbs: { id: string | null; name: string }[] = [{ id: null, name: 'Storage Vault' }];
    if (folderId && !starredOnly) {
      let currentId: string | null = folderId;
      const chain: { id: string; name: string }[] = [];

      while (currentId) {
        const { data: curFolder }: { data: any } = await supabase
          .from('folders')
          .select('id, name, parent_id')
          .eq('id', currentId)
          .single();

        if (curFolder) {
          chain.unshift({ id: curFolder.id, name: curFolder.name });
          currentId = curFolder.parent_id;
        } else {
          break;
        }
      }
      breadcrumbs.push(...chain);
    }

    return res.json({
      folders: (folders || []).map(f => ({ ...f, is_starred: Boolean(f.is_starred) })),
      files: (files || []).map(f => ({ ...f, is_starred: Boolean(f.is_starred) })),
      breadcrumbs,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/drive/storage', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { data: files, error } = await supabase
      .from('files')
      .select('size_bytes, mime_type')
      .eq('owner_id', userId)
      .eq('is_deleted', false);

    if (error) throw error;

    let images = 0;
    let videos = 0;
    let audio = 0;
    let documents = 0;
    let others = 0;

    const usedBytes = (files || []).reduce((acc, curr) => {
      const size = Number(curr.size_bytes) || 0;
      const mime = curr.mime_type || '';
      if (mime.startsWith('image/')) images += size;
      else if (mime.startsWith('video/')) videos += size;
      else if (mime.startsWith('audio/')) audio += size;
      else if (mime.includes('pdf') || mime.includes('document') || mime.includes('text') || mime.includes('json')) documents += size;
      else others += size;
      return acc + size;
    }, 0);

    return res.json({
      usedBytes,
      totalBytes: 5 * 1024 * 1024 * 1024,
      breakdown: { images, videos, audio, documents, others },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/folders', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { name, parent_id } = req.body;
    const userId = req.user?.id;

    if (!name) return res.status(400).json({ error: 'Folder name required' });

    const { data: folder, error } = await supabase
      .from('folders')
      .insert([{
        name,
        parent_id: parent_id || null,
        owner_id: userId,
        is_deleted: false,
        is_starred: false,
      }])
      .select('*')
      .single();

    if (error) throw error;
    return res.status(201).json({ folder });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/files/upload-url', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { fileName } = req.body;
    const userId = req.user?.id;

    if (!fileName) return res.status(400).json({ error: 'File name required' });

    const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${userId}/${Date.now()}-${cleanFileName}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(storagePath);

    if (error) throw error;

    return res.json({
      uploadUrl: data?.signedUrl,
      token: data?.token,
      path: data?.path || storagePath,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/files', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { name, mime_type, size_bytes, storage_key, folder_id } = req.body;
    const userId = req.user?.id;

    const { data: file, error } = await supabase
      .from('files')
      .insert([{
        name,
        mime_type: mime_type || 'application/octet-stream',
        size_bytes: Number(size_bytes) || 0,
        storage_key,
        folder_id: folder_id || null,
        owner_id: userId,
        is_deleted: false,
        is_starred: false,
      }])
      .select('*')
      .single();

    if (error) throw error;
    return res.status(201).json({ file });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/files/:id/content', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const { data: file, error: fileErr } = await supabase
      .from('files')
      .select('*')
      .eq('id', id)
      .single();

    if (fileErr || !file) return res.status(404).json({ error: 'File not found' });
    if (file.owner_id !== userId) return res.status(403).json({ error: 'Unauthorized' });

    const { data: downloadData, error: downloadErr } = await supabase.storage
      .from(BUCKET_NAME)
      .download(file.storage_key);

    if (downloadErr || !downloadData) throw downloadErr;

    const content = await downloadData.text();
    return res.json({ content, file });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/files/:id/content', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user?.id;

    const { data: file, error: fileErr } = await supabase
      .from('files')
      .select('*')
      .eq('id', id)
      .single();

    if (fileErr || !file) return res.status(404).json({ error: 'File not found' });
    if (file.owner_id !== userId) return res.status(403).json({ error: 'Unauthorized' });

    const buffer = Buffer.from(content || '', 'utf-8');

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET_NAME)
      .update(file.storage_key, buffer, {
        contentType: file.mime_type || 'text/plain',
        upsert: true,
      });

    if (uploadErr) throw uploadErr;

    await supabase
      .from('files')
      .update({ size_bytes: buffer.length })
      .eq('id', id);

    return res.json({ message: 'Saved successfully', size_bytes: buffer.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.patch('/api/items/:type/:id/rename', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { type, id } = req.params;
    const { name } = req.body;
    const userId = req.user?.id;

    if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });

    const table = type === 'folder' ? 'folders' : 'files';
    const { data, error } = await supabase
      .from(table)
      .update({ name: name.trim() })
      .eq('id', id)
      .eq('owner_id', userId)
      .select('*')
      .single();

    if (error) throw error;
    return res.json({ item: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.patch('/api/items/:type/:id/star', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { type, id } = req.params;
    const { is_starred } = req.body;
    const userId = req.user?.id;

    const table = type === 'folder' ? 'folders' : 'files';
    const { data, error } = await supabase
      .from(table)
      .update({ is_starred: Boolean(is_starred) })
      .eq('id', id)
      .eq('owner_id', userId)
      .select('*')
      .single();

    if (error) throw error;
    return res.json({ item: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/files/:id/url', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const { data: file, error: fetchErr } = await supabase
      .from('files')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !file) return res.status(404).json({ error: 'File not found' });

    if (file.owner_id !== userId) {
      const { data: perm } = await supabase
        .from('permissions')
        .select('*')
        .eq('file_id', id)
        .eq('user_id', userId)
        .single();
      if (!perm) return res.status(403).json({ error: 'Access denied' });
    }

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(file.storage_key, 3600);

    if (error) throw error;
    return res.json({ url: data?.signedUrl, file });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Soft Delete (Moves to Trash)
app.delete('/api/items/:type/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { type, id } = req.params;
    const userId = req.user?.id;
    const table = type === 'folder' ? 'folders' : 'files';

    const { data, error } = await supabase
      .from(table)
      .update({ is_deleted: true })
      .eq('id', id)
      .eq('owner_id', userId)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Item not found or unauthorized' });
    }

    return res.json({ message: 'Item moved to trash' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ================= SHARING =================

app.post('/api/files/:id/share-link', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { expiresInHours = 168 } = req.body;
    const userId = req.user?.id;

    const { data: file, error: fileErr } = await supabase
      .from('files')
      .select('*')
      .eq('id', id)
      .eq('owner_id', userId)
      .single();

    if (fileErr || !file) return res.status(404).json({ error: 'File not found or unauthorized' });

    const expirySeconds = Math.max(3600, expiresInHours * 3600);
    const { data: signedData, error: signErr } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(file.storage_key, expirySeconds);

    if (signErr || !signedData?.signedUrl) throw signErr || new Error('Signing failed');

    return res.json({
      shareUrl: signedData.signedUrl,
      fileName: file.name,
      fileSize: file.size_bytes,
      expiresInHours,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/shares', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { file_id, email, role } = req.body;

    const { data: targetUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (!targetUser) return res.status(404).json({ error: 'Target user does not exist' });

    const { data: perm, error } = await supabase
      .from('permissions')
      .upsert(
        { file_id, user_id: targetUser.id, role: role || 'viewer' },
        { onConflict: 'file_id,user_id' }
      )
      .select('*')
      .single();

    if (error) throw error;
    return res.json({ permission: perm, message: 'Shared successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ================= TRASH MANAGEMENT =================

app.get('/api/trash', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const [{ data: folders, error: fErr }, { data: files, error: fileErr }] = await Promise.all([
      supabase
        .from('folders')
        .select('*')
        .eq('owner_id', userId)
        .eq('is_deleted', true)
        .order('created_at', { ascending: false }),
      supabase
        .from('files')
        .select('*')
        .eq('owner_id', userId)
        .eq('is_deleted', true)
        .order('created_at', { ascending: false }),
    ]);

    if (fErr) throw fErr;
    if (fileErr) throw fileErr;

    return res.json({ folders: folders || [], files: files || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/trash/restore', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { type, id } = req.body;
    const userId = req.user?.id;
    const table = type === 'folder' ? 'folders' : 'files';

    const { error } = await supabase
      .from(table)
      .update({ is_deleted: false })
      .eq('id', id)
      .eq('owner_id', userId);

    if (error) throw error;
    return res.json({ message: 'Restored successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/trash/permanent', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { type, id } = req.body;
    const userId = req.user?.id;

    if (type === 'file') {
      const { data: file } = await supabase
        .from('files')
        .select('storage_key')
        .eq('id', id)
        .eq('owner_id', userId)
        .single();

      if (file?.storage_key) {
        await supabase.storage.from(BUCKET_NAME).remove([file.storage_key]);
      }
      await supabase.from('files').delete().eq('id', id).eq('owner_id', userId);
    } else {
      await supabase.from('folders').delete().eq('id', id).eq('owner_id', userId);
    }

    return res.json({ message: 'Purged permanently' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Storage backend server live on port ${PORT}`);
});