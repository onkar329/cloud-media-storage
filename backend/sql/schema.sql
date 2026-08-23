create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null,
  password_hash text not null,
  image_url text,
  created_at timestamptz default now()
);

create table if not exists folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references users(id) on delete cascade,
  parent_id uuid references folders(id) on delete set null,
  is_deleted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index if not exists folders_owner_parent_name
on folders(owner_id,parent_id,name) where is_deleted=false;

create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mime_type text,
  size_bytes bigint,
  storage_key text unique not null,
  owner_id uuid references users(id) on delete cascade,
  folder_id uuid references folders(id) on delete set null,
  version_id uuid,
  checksum text,
  is_deleted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists files_owner_idx on files(owner_id);
create index if not exists files_name_trgm_idx on files using gin(name gin_trgm_ops);

create table if not exists file_versions (
  id uuid primary key default gen_random_uuid(),
  file_id uuid references files(id) on delete cascade,
  version_number int not null,
  storage_key text not null,
  size_bytes bigint,
  checksum text,
  created_at timestamptz default now()
);

create table if not exists shares (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null check(resource_type in ('file','folder')),
  resource_id uuid not null,
  grantee_user_id uuid references users(id) on delete cascade,
  role text not null check(role in ('viewer','editor')),
  created_by uuid references users(id) on delete set null,
  created_at timestamptz default now(),
  unique(resource_type,resource_id,grantee_user_id)
);

create table if not exists link_shares (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null check(resource_type in ('file','folder')),
  resource_id uuid not null,
  token text unique not null,
  role text not null default 'viewer' check(role='viewer'),
  password_hash text,
  expires_at timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists stars (
  user_id uuid references users(id) on delete cascade,
  resource_type text not null check(resource_type in ('file','folder')),
  resource_id uuid not null,
  primary key(user_id,resource_type,resource_id)
);

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users(id) on delete set null,
  action text not null check(action in ('upload','rename','delete','restore','move','share','download')),
  resource_type text not null check(resource_type in ('file','folder')),
  resource_id uuid not null,
  context jsonb,
  created_at timestamptz default now()
);
