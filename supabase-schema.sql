create table if not exists public.bot_state (
  id bigint primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.bot_state enable row level security;

create policy "bot state access"
on public.bot_state
for all
to anon
using (true)
with check (true);
