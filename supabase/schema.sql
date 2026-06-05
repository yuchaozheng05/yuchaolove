create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'screenshots',
  'screenshots',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  visitor_id text,
  ip text,
  country text,
  region text,
  city text,
  timezone text,
  latitude numeric,
  longitude numeric,
  location_label text,
  user_agent text,
  referer text,
  page_path text,
  browser_language text,
  client_timezone text,
  image_count integer not null default 0,
  storage_paths text[] not null default '{}',
  image_urls text[] not null default '{}',
  images jsonb not null default '[]'::jsonb,
  model text,
  degraded boolean not null default false,
  attitude_label text,
  attitude_desc text,
  interest_score integer,
  interest_level text,
  conversation_mode text,
  conversation_stage text,
  flirt_level text,
  replies jsonb not null default '[]'::jsonb,
  sticker_suggestions jsonb not null default '[]'::jsonb,
  chat_guide jsonb not null default '{}'::jsonb,
  dialogue jsonb not null default '[]'::jsonb,
  analysis_result jsonb not null default '{}'::jsonb,
  request_metadata jsonb not null default '{}'::jsonb
);

alter table public.usage_logs add column if not exists id uuid default gen_random_uuid();
alter table public.usage_logs add column if not exists created_at timestamptz not null default now();
alter table public.usage_logs add column if not exists visitor_id text;
alter table public.usage_logs add column if not exists ip text;
alter table public.usage_logs add column if not exists country text;
alter table public.usage_logs add column if not exists region text;
alter table public.usage_logs add column if not exists city text;
alter table public.usage_logs add column if not exists timezone text;
alter table public.usage_logs add column if not exists latitude numeric;
alter table public.usage_logs add column if not exists longitude numeric;
alter table public.usage_logs add column if not exists location_label text;
alter table public.usage_logs add column if not exists user_agent text;
alter table public.usage_logs add column if not exists referer text;
alter table public.usage_logs add column if not exists page_path text;
alter table public.usage_logs add column if not exists browser_language text;
alter table public.usage_logs add column if not exists client_timezone text;
alter table public.usage_logs add column if not exists image_count integer not null default 0;
alter table public.usage_logs add column if not exists storage_paths text[] not null default '{}';
alter table public.usage_logs add column if not exists image_urls text[] not null default '{}';
alter table public.usage_logs add column if not exists images jsonb not null default '[]'::jsonb;
alter table public.usage_logs add column if not exists model text;
alter table public.usage_logs add column if not exists degraded boolean not null default false;
alter table public.usage_logs add column if not exists attitude_label text;
alter table public.usage_logs add column if not exists attitude_desc text;
alter table public.usage_logs add column if not exists interest_score integer;
alter table public.usage_logs add column if not exists interest_level text;
alter table public.usage_logs add column if not exists conversation_mode text;
alter table public.usage_logs add column if not exists conversation_stage text;
alter table public.usage_logs add column if not exists flirt_level text;
alter table public.usage_logs add column if not exists replies jsonb not null default '[]'::jsonb;
alter table public.usage_logs add column if not exists sticker_suggestions jsonb not null default '[]'::jsonb;
alter table public.usage_logs add column if not exists chat_guide jsonb not null default '{}'::jsonb;
alter table public.usage_logs add column if not exists dialogue jsonb not null default '[]'::jsonb;
alter table public.usage_logs add column if not exists analysis_result jsonb not null default '{}'::jsonb;
alter table public.usage_logs add column if not exists request_metadata jsonb not null default '{}'::jsonb;

alter table public.usage_logs enable row level security;

create index if not exists usage_logs_created_at_idx on public.usage_logs (created_at desc);
create index if not exists usage_logs_visitor_id_idx on public.usage_logs (visitor_id);
create index if not exists usage_logs_country_city_idx on public.usage_logs (country, city);

create table if not exists public.conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  visitor_id text,
  target_person_label text not null default '对方',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_relationship_stage text,
  last_dialogue_summary text,
  last_replies jsonb not null default '[]'::jsonb,
  analysis_count integer not null default 1
);

create index if not exists conversation_sessions_session_id_idx
  on public.conversation_sessions (session_id);

create index if not exists conversation_sessions_visitor_id_idx
  on public.conversation_sessions (visitor_id);

alter table public.conversation_sessions enable row level security;

alter table public.usage_logs
  add column if not exists session_id text;

alter table public.usage_logs
  add column if not exists target_person_label text;

create index if not exists usage_logs_session_id_idx
  on public.usage_logs (session_id);
