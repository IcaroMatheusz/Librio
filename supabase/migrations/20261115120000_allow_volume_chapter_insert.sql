-- Allow a signed-in user to add their own books as chapters of their own volumes.
alter table public.volume_chapters enable row level security;
alter table public.book_volumes enable row level security;

create policy "Users can add chapters to their own volumes"
on public.volume_chapters
for insert
to authenticated
with check (
  exists (
    select 1
    from public.book_volumes as volume
    where volume.id = volume_chapters.volume_id
      and volume.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.books as book
    where book.id = volume_chapters.book_id
      and book.user_id = auth.uid()
  )
);

create policy "Users can update their own volumes"
on public.book_volumes
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
