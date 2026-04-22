-- Outreach tracker schema

create table if not exists threads (
  thread_id            text primary key,
  subject              text,
  recipients           text[],
  primary_recipient    text,
  company              text,
  sent_at              timestamptz,
  status               text check (status in ('Replied','Bounced','No response')),
  detail               text,
  reply_from           text,
  reply_snippet        text,
  message_count        int,
  updated_at           timestamptz default now()
);

create index if not exists threads_sent_at_idx on threads (sent_at desc);
create index if not exists threads_status_idx  on threads (status);

create table if not exists sync_state (
  key         text primary key,
  value       jsonb,
  updated_at  timestamptz default now()
);

alter table threads     enable row level security;
alter table sync_state  enable row level security;

drop policy if exists "Allow anon read" on threads;
drop policy if exists "Allow anon read" on sync_state;

create policy "Allow anon read" on threads     for select to anon using (true);
create policy "Allow anon read" on sync_state  for select to anon using (true);
