import path from 'path';
import dotenv from 'dotenv';
import ws from 'ws';
import { createClient } from '@supabase/supabase-js';

// Load .env explicitly
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL or Key missing in .env');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    transport: ws,
  },
});

export const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'drive';