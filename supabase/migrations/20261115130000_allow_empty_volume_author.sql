-- Volume authors are optional; keep the existing maximum length.
alter table public.book_volumes
  drop constraint if exists book_volumes_author_check;

alter table public.book_volumes
  add constraint book_volumes_author_check
  check (char_length(author) <= 160);
