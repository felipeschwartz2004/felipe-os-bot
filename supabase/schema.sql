-- Run this in your Supabase SQL editor: https://supabase.com/dashboard/project/gkjevtfagfqxuidnmxae/sql

create table if not exists os_state (
  id integer primary key default 1,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- Seed with empty state (bot will populate on first run)
insert into os_state (id, data) values (1, '{}') on conflict (id) do nothing;
