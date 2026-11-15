create table public.local_reading_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  local_book_id uuid not null,
  progress smallint not null default 0 check (progress between 0 and 100),
  last_read_at timestamptz not null default now(),
  primary key (user_id, local_book_id)
);

alter table public.local_reading_progress enable row level security;

create policy "Users can read their local reading progress"
  on public.local_reading_progress
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can create their local reading progress"
  on public.local_reading_progress
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their local reading progress"
  on public.local_reading_progress
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their local reading progress"
  on public.local_reading_progress
  for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete
  on public.local_reading_progress
  to authenticated;
