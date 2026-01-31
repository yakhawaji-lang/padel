-- انسخ هذا الملف بالكامل والصقه في Supabase → SQL Editor → New query ثم اضغط Run

create table if not exists app_store (
  key   text primary key,
  value jsonb not null default '[]'::jsonb
);

alter table app_store enable row level security;

create policy "Allow anonymous read and write for app_store"
  on app_store for all
  using (true)
  with check (true);
