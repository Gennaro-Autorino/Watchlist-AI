-- Watchlist AI: database schema
--
-- Run this whole file in Supabase > SQL Editor.
-- It is idempotent: it creates missing tables and columns and fixes constraints
-- on existing tables. It does not delete rows.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table if not exists public.media (
  id          uuid primary key default gen_random_uuid(),
  tmdb_id     integer not null,
  title       text not null,
  media_type  text not null,
  poster_path text,
  overview    text,
  created_at  timestamptz not null default now()
);

create table if not exists public.watchlist (
  id              uuid primary key default gen_random_uuid(),
  media_id        uuid not null,
  status          text not null default 'to_watch',
  current_season  integer not null default 1,
  current_episode integer not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Columns the app uses, in case the table already existed without them.
alter table public.watchlist add column if not exists status          text        not null default 'to_watch';
alter table public.watchlist add column if not exists current_season  integer     not null default 1;
alter table public.watchlist add column if not exists current_episode integer     not null default 1;
alter table public.watchlist add column if not exists created_at      timestamptz not null default now();
alter table public.watchlist add column if not exists updated_at      timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- 2. Constraints
-- ---------------------------------------------------------------------------

-- TMDB ids are unique per type only: movie 123 and TV show 123 are different titles.
-- Remove any unique constraint on media(tmdb_id) alone, then add (tmdb_id, media_type).
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.media'::regclass
      and con.contype = 'u'
      and con.conkey = array[
        (select attnum from pg_attribute
         where attrelid = 'public.media'::regclass and attname = 'tmdb_id')
      ]::smallint[]
  loop
    execute format('alter table public.media drop constraint %I', c.conname);
  end loop;
end $$;

-- A unique index (not a constraint) on tmdb_id alone would block the same rows.
drop index if exists public.media_tmdb_id_key;
drop index if exists public.media_tmdb_id_idx;

alter table public.media drop constraint if exists media_tmdb_id_media_type_key;
alter table public.media
  add constraint media_tmdb_id_media_type_key unique (tmdb_id, media_type);

alter table public.media drop constraint if exists media_media_type_check;
alter table public.media
  add constraint media_media_type_check check (media_type in ('movie', 'tv'));

-- One watchlist row per title. The app upserts with onConflict: 'media_id'.
alter table public.watchlist drop constraint if exists watchlist_media_id_key;
alter table public.watchlist
  add constraint watchlist_media_id_key unique (media_id);

-- Foreign key: the app reads watchlist with an embedded media(...) select.
-- Deleting a media row also deletes its watchlist row.
alter table public.watchlist drop constraint if exists watchlist_media_id_fkey;
alter table public.watchlist
  add constraint watchlist_media_id_fkey
  foreign key (media_id) references public.media (id) on delete cascade;

alter table public.watchlist drop constraint if exists watchlist_status_check;
alter table public.watchlist
  add constraint watchlist_status_check
  check (status in ('to_watch', 'watching', 'completed'));

alter table public.watchlist drop constraint if exists watchlist_progress_check;
alter table public.watchlist
  add constraint watchlist_progress_check
  check (current_season between 1 and 1000 and current_episode between 1 and 10000);

-- The watchlist page sorts by updated_at.
create index if not exists watchlist_updated_at_idx
  on public.watchlist (updated_at desc);

-- ---------------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------------
--
-- IMPORTANT: the app has no login yet and uses the public anon key.
-- These policies let anyone who has the anon key read and write both tables.
-- The anon key is visible in the browser, so the data is NOT private.
-- To make the list private, add Supabase Auth, a user_id column on watchlist,
-- and replace these policies with "user_id = auth.uid()".

alter table public.media     enable row level security;
alter table public.watchlist enable row level security;

grant select, insert, update         on public.media     to anon, authenticated;
grant select, insert, update, delete on public.watchlist to anon, authenticated;

drop policy if exists "media: public read"   on public.media;
drop policy if exists "media: public insert" on public.media;
drop policy if exists "media: public update" on public.media;

create policy "media: public read"   on public.media for select to anon, authenticated using (true);
create policy "media: public insert" on public.media for insert to anon, authenticated with check (true);
create policy "media: public update" on public.media for update to anon, authenticated using (true) with check (true);
-- No delete policy on media: the app never deletes media rows.

drop policy if exists "watchlist: public read"   on public.watchlist;
drop policy if exists "watchlist: public insert" on public.watchlist;
drop policy if exists "watchlist: public update" on public.watchlist;
drop policy if exists "watchlist: public delete" on public.watchlist;

create policy "watchlist: public read"   on public.watchlist for select to anon, authenticated using (true);
create policy "watchlist: public insert" on public.watchlist for insert to anon, authenticated with check (true);
create policy "watchlist: public update" on public.watchlist for update to anon, authenticated using (true) with check (true);
create policy "watchlist: public delete" on public.watchlist for delete to anon, authenticated using (true);

-- Refresh the PostgREST schema cache so the API sees the changes now.
notify pgrst, 'reload schema';
