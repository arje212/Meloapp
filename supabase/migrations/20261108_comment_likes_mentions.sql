-- Comment likes (saved in the database, so the heart no longer disappears) + @mentions in comments.
-- Safe to run more than once. Run in the Supabase SQL Editor.

-- 1) comment_likes: created with the SAME id type as comments.id (uuid or bigint), whatever you have
do $$
declare
  id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into id_type
  from pg_attribute a
  where a.attrelid = 'public.comments'::regclass and a.attname = 'id' and not a.attisdropped;

  if id_type is null then
    raise exception 'public.comments table not found';
  end if;

  execute format($f$
    create table if not exists public.comment_likes (
      id           uuid primary key default gen_random_uuid(),
      comment_id   %s not null references public.comments(id) on delete cascade,
      user_id      uuid not null references auth.users(id) on delete cascade,
      created_date timestamptz not null default now(),
      unique (comment_id, user_id)
    )$f$, id_type);
end $$;

create index if not exists comment_likes_comment_idx on public.comment_likes (comment_id);

alter table public.comment_likes enable row level security;
drop policy if exists "comment_likes_read"   on public.comment_likes;
drop policy if exists "comment_likes_insert" on public.comment_likes;
drop policy if exists "comment_likes_delete" on public.comment_likes;
create policy "comment_likes_read"   on public.comment_likes for select to authenticated using (true);
create policy "comment_likes_insert" on public.comment_likes for insert to authenticated with check (user_id = auth.uid());
create policy "comment_likes_delete" on public.comment_likes for delete to authenticated using (user_id = auth.uid());

-- 2) who was @mentioned in a comment: [{ "id": "<profile id>", "name": "Full Name" }]
alter table public.comments add column if not exists mentions jsonb not null default '[]'::jsonb;
