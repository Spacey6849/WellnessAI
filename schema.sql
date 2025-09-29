-- Supabase schema for WellnessAI
-- Assumptions:
-- 1. Using built-in auth.users table for primary user identity (email + password / magic link / OAuth)
-- 2. We extend user profile via public.user_profiles (1:1 with auth.users)
-- 3. Community features: posts, replies, likes (array of user uuids), soft RLS with policies.
-- 4. Future expansion: journaling, bookings, mood tracking placeholders.
-- Execute in SQL editor in Supabase project. Run in order.

-- Enable required extensions (idempotent)
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- =============================
-- USER PROFILE
-- =============================
create table if not exists public.user_profiles (
  user_id uuid primary key, -- decouple FK to auth.users; application layer ensures alignment
  -- Store email (duplicated from auth.users.email for easier joins / lookups). We keep it nullable
  -- in case legacy rows exist; a backfill statement + trigger below maintains sync.
  email text unique,
  username text unique,
  display_name text,
  avatar_url text,
  role text not null default 'user', -- 'user' | 'admin'
  phone text,
  -- Application-managed auth adjunct fields (Supabase already stores email & encrypted password in auth.users)
  hashed_password text, -- optional: only if you manage custom password flow outside Supabase auth (store a bcrypt/argon2 hash)
  email_verified_at timestamptz, -- null until user verifies email (if using custom verification workflow)
  email_verification_token text, -- single-use token for email confirmation
  email_verification_token_expires_at timestamptz,
  reset_password_token text, -- single-use token for password reset
  reset_password_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backfill new columns for legacy deployments where table existed before these fields were added.
alter table public.user_profiles add column if not exists username text unique;
alter table public.user_profiles add column if not exists email text;
do $$ begin
  -- Add unique index for email if not already present (can't declare unique twice idempotently if column may pre-exist without constraint)
  begin
    execute 'create unique index if not exists user_profiles_email_key on public.user_profiles(email)';
  exception when others then null; end;
end $$;

-- =====================================================================
-- MIGRATION: Relax user_journal FK for pseudo / anonymous client IDs
-- Rationale: Frontend currently supplies a client-generated UUID via header (x-user-id)
-- even when the user hasn't completed auth/signup, so no row exists in user_profiles.
-- This caused:  insert or update on table "user_journal" violates foreign key constraint
-- Solution: Drop FK (if present) to allow journaling before account creation while keeping
-- the column name (user_id) for future linkage. When a user later signs up, client can
-- reuse the same UUID so historical entries naturally associate in-app logic.
-- NOTE: If you require strict referential integrity, revert by re‑adding the FK after
-- ensuring all orphan user_id values have corresponding user_profiles rows.
do $$ begin
  if exists (
    select 1 from information_schema.table_constraints
      where table_schema='public'
        and table_name='user_journal'
        and constraint_name='user_journal_user_id_fkey'
  ) then
    alter table public.user_journal drop constraint user_journal_user_id_fkey;
  end if;
exception when others then null; end $$;

-- Strengthen data quality: topic length + mood_snapshot range (idempotent add constraints)
do $$ begin
  begin
    alter table public.user_journal add constraint user_journal_topic_len
      check (topic is null or char_length(topic) <= 120);
  exception when others then null; end;
  begin
    alter table public.user_journal add constraint user_journal_mood_snapshot_range
      check (mood_snapshot is null or (mood_snapshot between 1 and 5));
  exception when others then null; end;
end $$;

-- Helpful partial index for mood_snapshot analytics (skip nulls)
create index if not exists idx_user_journal_user_mood_created
  on public.user_journal(user_id, mood_snapshot, created_at desc)
  where mood_snapshot is not null;

alter table public.user_profiles add column if not exists display_name text;
alter table public.user_profiles add column if not exists avatar_url text;
alter table public.user_profiles add column if not exists role text not null default 'user';
alter table public.user_profiles add column if not exists phone text;
alter table public.user_profiles add column if not exists hashed_password text;
alter table public.user_profiles add column if not exists email_verified_at timestamptz;
alter table public.user_profiles add column if not exists email_verification_token text;
alter table public.user_profiles add column if not exists email_verification_token_expires_at timestamptz;
alter table public.user_profiles add column if not exists reset_password_token text;
alter table public.user_profiles add column if not exists reset_password_token_expires_at timestamptz;
alter table public.user_profiles add column if not exists created_at timestamptz not null default now();
alter table public.user_profiles add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;$$;

-- Ensure idempotent trigger creation
drop trigger if exists trg_user_profiles_updated on public.user_profiles;
create trigger trg_user_profiles_updated
before update on public.user_profiles
for each row execute procedure public.set_updated_at();

-- Auto create profile row after user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles(user_id, username, display_name)
  values (new.id, split_part(new.email,'@',1), split_part(new.email,'@',1))
  on conflict do nothing;
  return new;
end;$$;

-- Optional: cleanup expired tokens (run via pg_cron or external scheduler)
create or replace function public.clear_expired_user_tokens()
returns void language plpgsql as $$
begin
  update public.user_profiles
     set email_verification_token = null,
         email_verification_token_expires_at = null
   where email_verification_token_expires_at is not null
     and email_verification_token_expires_at < now();

  update public.user_profiles
     set reset_password_token = null,
         reset_password_token_expires_at = null
   where reset_password_token_expires_at is not null
     and reset_password_token_expires_at < now();
end;$$;

-- Helpful indexes for token lookups (avoid sequential scans)
create index if not exists idx_user_profiles_email_verification_token on public.user_profiles(email_verification_token) where email_verification_token is not null;
create index if not exists idx_user_profiles_reset_password_token on public.user_profiles(reset_password_token) where reset_password_token is not null;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- =============================================
-- EMAIL SYNC FROM auth.users -> public.user_profiles
-- =============================================
create or replace function public.sync_user_profile_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.user_profiles set email = new.email where user_id = new.id;
  return new;
end;$$;

drop trigger if exists trg_auth_user_email_sync on auth.users;
create trigger trg_auth_user_email_sync
after insert or update of email on auth.users
for each row execute procedure public.sync_user_profile_email();

-- Backfill existing rows where email null
update public.user_profiles p
set email = u.email
from auth.users u
where p.user_id = u.id and p.email is null;

-- =============================
-- COMMUNITY: POSTS & REPLIES
-- =============================
create table if not exists public.community_posts (
  id uuid primary key default uuid_generate_v4(),
  -- author_id relaxed to allow null so that dev/mock anonymous posts can be stored
  -- (In production you may want to enforce NOT NULL again once real auth is always present.)
  author_id uuid references auth.users(id) on delete set null,
  topic text,
  -- Legacy free-form category (will be deprecated by category_id join to community_categories)
  category text,
  -- Relational category reference added later via migration block at end of file to avoid forward FK dependency
  content text not null check (char_length(content) <= 4000),
  likes uuid[] not null default '{}',
  reply_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Constraints for anonymity-related metadata
  constraint community_posts_topic_len check (topic is null or char_length(topic) <= 120),
  constraint community_posts_category_allowed check (
    category is null or category in (
      'Mindfulness','Stress Relief','Sleep','Nutrition','Movement',
      'Anxiety Support','Depression Support','Motivation','Self-Compassion','Gratitude'
    )
  )
);

-- Forum categories (normalized) tied to therapist specialty domains
create table if not exists public.community_categories (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  label text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.community_categories enable row level security;
-- Public readable categories
drop policy if exists "CommunityCategories: select" on public.community_categories;
create policy "CommunityCategories: select" on public.community_categories for select using (true);
-- Admin manage categories
drop policy if exists "CommunityCategories: admin all" on public.community_categories;
create policy "CommunityCategories: admin all" on public.community_categories for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop trigger if exists trg_community_categories_updated on public.community_categories;
create trigger trg_community_categories_updated
before update on public.community_categories
for each row execute procedure public.set_updated_at();

-- Seed default categories (idempotent) aligned with therapist specialties
insert into public.community_categories(slug,label,description) values
  ('anxiety','Anxiety Support','Strategies, grounding, shared experiences'),
  ('depression','Depression Support','Managing lows, motivation, recovery stories'),
  ('mindfulness','Mindfulness','Meditation, breathing, present-moment practices'),
  ('sleep','Sleep Health','Sleep hygiene, routines, insomnia help'),
  ('stress','Stress Relief','Coping with pressure, relaxation tactics'),
  ('relationships','Relationships','Interpersonal dynamics, boundaries, communication'),
  ('self-esteem','Self-Esteem','Confidence, self-talk, identity growth'),
  ('trauma','Trauma Recovery','Processing, resilience, safe sharing'),
  ('nutrition','Nutrition','Food, mood, and mindful eating'),
  ('movement','Movement','Exercise, somatic release, body awareness')
on conflict (slug) do nothing;

-- Helpful index for category-based filtering on posts
-- Index on category_id created in post-add migrations section once column is added

drop trigger if exists trg_posts_updated on public.community_posts;
create trigger trg_posts_updated
before update on public.community_posts
for each row execute procedure public.set_updated_at();

-- Replies (short-form). UI enforces 1000 char limit; align DB constraint for consistency (was 3000 previously).
create table if not exists public.community_replies (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  -- Allow null author for dev/mock replies; production can tighten this.
  author_id uuid references auth.users(id) on delete set null,
  content text not null check (char_length(content) <= 1000),
  created_at timestamptz not null default now()
);

-- If upgrading from earlier schema with 3000 char limit, drop & recreate constraint idempotently
do $$ begin
  if exists (
    select 1 from information_schema.constraint_column_usage
    where table_schema='public' and table_name='community_replies' and constraint_name like '%content%'
  ) then
    -- Attempt to relax by dropping old constraint if >1000 allowed; safe no-op if already correct
    begin
      alter table public.community_replies drop constraint if exists community_replies_content_check;
    exception when others then null; end;
  end if;
  -- Re-add correct constraint (name deterministic)
  begin
    alter table public.community_replies add constraint community_replies_content_len check (char_length(content) <= 1000);
  exception when others then null; end;
end $$;

-- =============================
-- THERAPISTS (admin managed)
-- =============================
create table if not exists public.therapists (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  specialty text not null,
  email text not null unique,
  phone text,
  bio text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.therapists enable row level security;
drop trigger if exists trg_therapists_updated on public.therapists;
create trigger trg_therapists_updated
before update on public.therapists
for each row execute procedure public.set_updated_at();

-- Policies: only admins can manage; everyone can read active therapists
drop policy if exists "Therapists: public select active" on public.therapists;
create policy "Therapists: public select active" on public.therapists
for select using (active = true);
drop policy if exists "Therapists: admin modify" on public.therapists;
create policy "Therapists: admin modify" on public.therapists
for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create index if not exists idx_therapists_active on public.therapists(active) where active = true;

-- =============================
-- APP SETTINGS / FEATURE FLAGS
-- =============================
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
drop trigger if exists trg_app_settings_updated on public.app_settings;
create trigger trg_app_settings_updated
before update on public.app_settings
for each row execute procedure public.set_updated_at();

-- Allow anyone to read non-sensitive settings (could refine with a column later)
drop policy if exists "AppSettings: select" on public.app_settings;
create policy "AppSettings: select" on public.app_settings for select using (true);
drop policy if exists "AppSettings: admin upsert" on public.app_settings;
create policy "AppSettings: admin upsert" on public.app_settings for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Seed some defaults (idempotent)
insert into public.app_settings(key, value, description) values
  ('booking.enabled', '{"enabled": true}', 'Globally enable/disable booking feature'),
  ('community.moderation.autoFlag', '{"enabled": true, "threshold": 0.85}', 'Enable AI auto-flagging of toxic content'),
  ('ui.experiment.darkGradient', '{"enabled": true}', 'Toggle new gradient background')
on conflict (key) do nothing;

-- Maintain reply_count
create or replace function public.sync_reply_count()
returns trigger language plpgsql as $$
begin
  update public.community_posts p
    set reply_count = (select count(*) from public.community_replies r where r.post_id = p.id)
  where p.id = coalesce(new.post_id, old.post_id);
  return null;
end;$$;

drop trigger if exists trg_replies_after_change on public.community_replies;
create trigger trg_replies_after_change
after insert or delete on public.community_replies
for each row execute procedure public.sync_reply_count();

-- =============================
-- RELAX FK CONSTRAINTS (idempotent) FOR DEV ANON POSTS
-- =============================
-- Ensure author_id columns are nullable and have ON DELETE SET NULL behavior even if table pre-existed.
alter table public.community_posts alter column author_id drop not null;
alter table public.community_posts drop constraint if exists community_posts_author_id_fkey;
alter table public.community_posts add constraint community_posts_author_id_fkey foreign key (author_id) references public.user_profiles(user_id) on delete set null;

alter table public.community_replies alter column author_id drop not null;
alter table public.community_replies drop constraint if exists community_replies_author_id_fkey;
alter table public.community_replies add constraint community_replies_author_id_fkey foreign key (author_id) references public.user_profiles(user_id) on delete set null;

comment on column public.community_posts.author_id is 'Nullable in dev to allow anonymous mock posts; set NOT NULL in production if desired';
comment on column public.community_replies.author_id is 'Nullable in dev to allow anonymous mock replies; set NOT NULL in production if desired';

-- Auto-fill author_id with auth.uid() if null on insert (supports anonymous dev posts that become attributed once logged in)
create or replace function public.set_post_author_default()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.author_id is null then
    new.author_id := auth.uid();
  end if;
  return new;
end;$$;

drop trigger if exists trg_posts_set_author on public.community_posts;
create trigger trg_posts_set_author
before insert on public.community_posts
for each row execute procedure public.set_post_author_default();

create or replace function public.set_reply_author_default()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.author_id is null then
    new.author_id := auth.uid();
  end if;
  return new;
end;$$;

drop trigger if exists trg_replies_set_author on public.community_replies;
create trigger trg_replies_set_author
before insert on public.community_replies
for each row execute procedure public.set_reply_author_default();

-- =============================
-- ROW LEVEL SECURITY
-- =============================
alter table public.user_profiles enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_replies enable row level security;

-- Profiles: users can view all, update only their own
drop policy if exists "Profiles: select" on public.user_profiles;
create policy "Profiles: select" on public.user_profiles
for select using (true);
drop policy if exists "Profiles: update own" on public.user_profiles;
create policy "Profiles: update own" on public.user_profiles
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Posts: anyone authenticated can select/insert; update/delete only owner or admin
create or replace function public.is_admin(uid uuid)
returns boolean language sql as $$
  select exists(
    select 1 from public.user_profiles where user_id = uid and role = 'admin'
  );
$$;

-- We will hide author_id from general clients by revoking direct SELECT on the base table
-- and exposing a view without author_id. (If you want completely public table access,
-- you may restore the old policy instead.)
drop policy if exists "Posts: select" on public.community_posts; -- (select removed intentionally; access via view)
drop policy if exists "Posts: insert" on public.community_posts;
create policy "Posts: insert" on public.community_posts
for insert with check (auth.role() = 'authenticated');
drop policy if exists "Posts: update own or admin" on public.community_posts;
create policy "Posts: update own or admin" on public.community_posts
for update using (author_id = auth.uid() or public.is_admin(auth.uid()))
with check (author_id = auth.uid() or public.is_admin(auth.uid()));
drop policy if exists "Posts: delete own or admin" on public.community_posts;
create policy "Posts: delete own or admin" on public.community_posts
for delete using (author_id = auth.uid() or public.is_admin(auth.uid()));

-- Replies: similar rules
drop policy if exists "Replies: select" on public.community_replies;
create policy "Replies: select" on public.community_replies
for select using (true); -- replies do not expose author_id directly at API layer
drop policy if exists "Replies: insert" on public.community_replies;
create policy "Replies: insert" on public.community_replies
for insert with check (auth.role() = 'authenticated');
drop policy if exists "Replies: delete own or admin" on public.community_replies;
create policy "Replies: delete own or admin" on public.community_replies
for delete using (author_id = auth.uid() or public.is_admin(auth.uid()));

-- =============================
-- LIKE TOGGLE FUNCTION (server-side convenience)
-- =============================
create or replace function public.toggle_post_like(p_post_id uuid)
returns table (post_id uuid, likes uuid[]) language plpgsql as $$
declare
  uid uuid := auth.uid();
  current_likes uuid[];
  updated_likes uuid[];
begin
  if uid is null then
    raise exception 'auth required';
  end if;
  select likes into current_likes from public.community_posts where id = p_post_id;
  if current_likes is null then
    raise exception 'post not found';
  end if;
  if uid = any(current_likes) then
    -- remove like
    updated_likes = array(select unnest(current_likes) except select uid);
  else
    updated_likes = array_append(current_likes, uid);
  end if;
  update public.community_posts set likes = updated_likes where id = p_post_id;
  return query select p_post_id as post_id, updated_likes as likes;
end;$$;

-- =============================
-- ANONYMIZED PUBLIC VIEW (no author_id)
-- =============================
-- Revoke direct select on base posts table from anon/auth roles to prevent leaking author_id
revoke select on public.community_posts from anon, authenticated;

create or replace view public.community_posts_public as
  select id, topic, category, content, likes, reply_count, created_at, updated_at
  from public.community_posts;

grant select on public.community_posts_public to anon, authenticated;

-- Optional index to speed recent post queries
create index if not exists idx_community_posts_created_at on public.community_posts(created_at desc);

-- =============================
-- OPTIONAL: JOURNAL / MOOD (placeholders for future)
-- =============================
create table if not exists public.mood_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  mood int not null check (mood between 1 and 10),
  sleep_hours numeric(4,1),
  energy int,
  stress int,
  note text,
  created_at timestamptz not null default now()
);

alter table public.mood_entries enable row level security;
drop policy if exists "Mood: select own" on public.mood_entries;
create policy "Mood: select own" on public.mood_entries
for select using (auth.uid() = user_id);
drop policy if exists "Mood: insert own" on public.mood_entries;
create policy "Mood: insert own" on public.mood_entries
for insert with check (auth.uid() = user_id);

-- =============================
-- JOURNAL ENTRIES
-- =============================
-- Journal entries intentionally DO NOT maintain a foreign key to user_profiles to
-- support pre-auth / anonymous journaling with a client-generated UUID. This allows
-- capturing thoughts before account creation. When a real account is later created,
-- an application-level migration step can reassign orphan rows (update user_id) and
-- optionally reintroduce an FK if strict integrity is desired.
-- DO NOT add a FK here unless you have a backfill + merge strategy.
create table if not exists public.user_journal (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null, -- no FK by design (see rationale above)
  topic text, -- optional categorization / label
  entry text not null check (char_length(entry) <= 8000),
  mood_snapshot int, -- optional capture at time of writing (1..5 UI bounded)
  created_at timestamptz not null default now()
);

alter table public.user_journal enable row level security;
drop policy if exists "Journal: select own" on public.user_journal;
create policy "Journal: select own" on public.user_journal for select using (auth.uid() = user_id);
drop policy if exists "Journal: insert own" on public.user_journal;
create policy "Journal: insert own" on public.user_journal for insert with check (auth.uid() = user_id);

-- Backfill / ensure topic column exists if table pre-dated addition
alter table public.user_journal add column if not exists topic text;

-- Lightweight index to support filtering by topic per user (optional, partial to non-null topics)
create index if not exists idx_user_journal_user_topic_created on public.user_journal(user_id, topic, created_at desc) where topic is not null;

create index if not exists idx_user_journal_user_created on public.user_journal(user_id, created_at desc);

-- =============================
-- SLEEP ENTRIES
-- =============================
create table if not exists public.sleep_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  date date not null,
  hours numeric(4,1) not null check (hours between 0 and 24),
  quality int, -- 1-10 subjective
  created_at timestamptz not null default now(),
  unique(user_id, date)
);

alter table public.sleep_entries enable row level security;
drop policy if exists "Sleep: select own" on public.sleep_entries;
create policy "Sleep: select own" on public.sleep_entries for select using (auth.uid() = user_id);
drop policy if exists "Sleep: upsert own" on public.sleep_entries;
create policy "Sleep: upsert own" on public.sleep_entries for insert with check (auth.uid() = user_id);
drop policy if exists "Sleep: update own" on public.sleep_entries;
create policy "Sleep: update own" on public.sleep_entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_sleep_entries_user_date on public.sleep_entries(user_id, date desc);

-- =============================
-- DAILY QUOTES (caching inspirational quote per UTC day)
-- =============================
create table if not exists public.daily_quotes (
  quote_date date primary key,
  quote text not null check (char_length(quote) <= 500),
  author text,
  source text,
  created_at timestamptz not null default now()
);

alter table public.daily_quotes enable row level security;
drop policy if exists "DailyQuotes: select" on public.daily_quotes;
create policy "DailyQuotes: select" on public.daily_quotes for select using (true);
drop policy if exists "DailyQuotes: upsert admin" on public.daily_quotes;
create policy "DailyQuotes: upsert admin" on public.daily_quotes for insert with check (public.is_admin(auth.uid()));

-- Helper function: returns existing quote for today or inserts a supplied/generated one (service role usage)
create or replace function public.ensure_daily_quote(p_quote text, p_author text default null, p_source text default null, p_for_date date default null)
returns table(quote_date date, quote text, author text, source text) language plpgsql as $$
declare
  d date := coalesce(p_for_date, (now() at time zone 'utc')::date);
begin
  -- Try fetch existing
  return query
    select q.quote_date, q.quote, q.author, q.source from public.daily_quotes q where q.quote_date = d;
  if found then
    return; -- already returned existing row
  end if;

  insert into public.daily_quotes(quote_date, quote, author, source)
  values (d, p_quote, p_author, p_source)
  on conflict (quote_date) do update set quote = excluded.quote
  returning daily_quotes.quote_date, daily_quotes.quote, daily_quotes.author, daily_quotes.source;
end;$$;

-- =============================
-- STREAK SUPPORT (login/activity)
-- =============================
-- Add streak fields to user_profiles if absent
alter table public.user_profiles add column if not exists daily_streak int not null default 0;
alter table public.user_profiles add column if not exists last_activity_date date;

create or replace function public.update_daily_streak(p_user_id uuid)
returns void language plpgsql as $$
declare
  today date := (now() at time zone 'utc')::date;
  last_date date;
  current_streak int;
begin
  select last_activity_date, daily_streak into last_date, current_streak from public.user_profiles where user_id = p_user_id for update;
  if last_date is null then
    update public.user_profiles set daily_streak = 1, last_activity_date = today where user_id = p_user_id;
    return; 
  end if;
  if last_date = today then
    return; -- already counted today
  elsif last_date = today - 1 then
    update public.user_profiles set daily_streak = current_streak + 1, last_activity_date = today where user_id = p_user_id;
  else
    update public.user_profiles set daily_streak = 1, last_activity_date = today where user_id = p_user_id;
  end if;
end;$$;

-- Heartbeat function callable from API to record activity + optional mood quick log
create or replace function public.activity_heartbeat(p_sleep_hours numeric, p_mood int)
returns void language plpgsql as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'auth required';
  end if;
  perform public.update_daily_streak(uid);
  if p_mood is not null then
    insert into public.mood_entries(user_id, mood, sleep_hours) values (uid, p_mood, p_sleep_hours);
  end if;
end;$$;

-- =============================
-- ADMIN ACCOUNTS (manual management)
-- =============================
create table if not exists public.admin_accounts (
  id uuid primary key default uuid_generate_v4(),
  email varchar(190) not null unique,
  username varchar(40) not null unique,
  password_hash varchar(255) not null,
  created_at timestamptz default now()
);

alter table public.admin_accounts enable row level security;
-- No general select policy (avoid leaking). Optional: allow admins to view themselves.
drop policy if exists "AdminAccounts: select own" on public.admin_accounts;
create policy "AdminAccounts: select own" on public.admin_accounts
for select using (auth.uid() in (select user_id from public.user_profiles where role='admin'));
-- Insert/update/delete should only occur via service role (no policy) or future secured RPC.

create index if not exists idx_admin_accounts_username on public.admin_accounts(username);

-- =============================
-- CHAT SESSIONS & MESSAGES
-- =============================
-- A session groups a series of user <-> AI exchanges.
create table if not exists public.chat_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.user_profiles(user_id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_chat_sessions_updated on public.chat_sessions;
create trigger trg_chat_sessions_updated
before update on public.chat_sessions
for each row execute procedure public.set_updated_at();

create table if not exists public.chat_messages (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  user_id uuid references public.user_profiles(user_id) on delete set null,
  role text not null check (role in ('user','assistant','system')),
  username text, -- captured display username at time of message (optional)
  prompt text, -- original user prompt (for role='user')
  ai_response text, -- model response (for role='assistant')
  metadata jsonb, -- optional token counts, model name, etc.
  created_at timestamptz not null default now()
);

-- Indexes for efficient querying
create index if not exists idx_chat_messages_session_created on public.chat_messages(session_id, created_at);

alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

-- Policies: users can see only their own sessions/messages; anonymous (not logged in) cannot persist.
drop policy if exists "ChatSessions: select own" on public.chat_sessions;
create policy "ChatSessions: select own" on public.chat_sessions
for select using (auth.uid() = user_id);
drop policy if exists "ChatSessions: insert own" on public.chat_sessions;
create policy "ChatSessions: insert own" on public.chat_sessions
for insert with check (auth.uid() = user_id);
drop policy if exists "ChatSessions: update own" on public.chat_sessions;
create policy "ChatSessions: update own" on public.chat_sessions
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "ChatSessions: delete own" on public.chat_sessions;
create policy "ChatSessions: delete own" on public.chat_sessions
for delete using (auth.uid() = user_id);

drop policy if exists "ChatMessages: select own" on public.chat_messages;
create policy "ChatMessages: select own" on public.chat_messages
for select using (session_id in (select id from public.chat_sessions where user_id = auth.uid()));
drop policy if exists "ChatMessages: insert own" on public.chat_messages;
create policy "ChatMessages: insert own" on public.chat_messages
for insert with check (
  -- message belongs to a session owned by user
  (select user_id from public.chat_sessions where id = session_id) = auth.uid()
);
drop policy if exists "ChatMessages: delete own" on public.chat_messages;
create policy "ChatMessages: delete own" on public.chat_messages
for delete using (
  (select user_id from public.chat_sessions where id = session_id) = auth.uid()
);

-- Optional helper to auto-create a session
create or replace function public.ensure_chat_session(p_session_id uuid, p_user_id uuid, p_title text default null)
returns uuid language plpgsql as $$
declare
  sid uuid;
begin
  if p_session_id is not null then
    select id into sid from public.chat_sessions where id = p_session_id and user_id = p_user_id;
    if sid is not null then
      return sid;
    end if;
  end if;
  insert into public.chat_sessions(user_id, title) values (p_user_id, coalesce(p_title,'New Session')) returning id into sid;
  return sid;
end;$$;

-- =============================
-- BOOKINGS (prevent slot collisions)
-- =============================
create table if not exists public.bookings (
  id uuid primary key default uuid_generate_v4(),
  therapist_id uuid not null references public.therapists(id) on delete cascade,
  user_id uuid references public.user_profiles(user_id) on delete set null,
  date date not null,
  slot text not null check (slot ~ '^[0-2][0-9]:[0-5][0-9]$'), -- HH:MM 24h
  session_type text,
  notes text,
  contact_email text,
  created_at timestamptz not null default now(),
  -- Added via migration: optional Google Meet integration fields
  meet_url text,
  calendar_event_id text,
  unique(therapist_id, date, slot)
);

-- Index to accelerate lookup for a therapist's day
create index if not exists idx_bookings_therapist_date on public.bookings(therapist_id, date);

-- Idempotent alters for deployments created before meet_url/calendar_event_id were introduced
alter table public.bookings add column if not exists meet_url text;
alter table public.bookings add column if not exists calendar_event_id text;
create index if not exists idx_bookings_calendar_event_id on public.bookings(calendar_event_id) where calendar_event_id is not null;

-- (RLS intentionally NOT enabled yet; all access goes through service role API route.)

-- =============================
-- END OF SCHEMA
-- =============================

-- =============================================================
-- POST-ADD MIGRATIONS (idempotent) FOR NEW FEATURES
-- =============================================================
-- Ensure community_posts has category_id column referencing community_categories
alter table public.community_posts add column if not exists category_id uuid references public.community_categories(id);
-- Helpful partial index for filtering by category_id
create index if not exists idx_community_posts_cat_id on public.community_posts(category_id) where category_id is not null;

-- Extended view combining legacy fields with relational category metadata (safe recreate)
drop view if exists public.community_posts_public_extended;
create view public.community_posts_public_extended as
  select p.id,
         p.topic,
         p.category, -- legacy text
         p.category_id,
         c.slug as category_slug,
         c.label as category_label,
         p.content,
         p.likes,
         p.reply_count,
         p.created_at,
         p.updated_at
    from public.community_posts p
    left join public.community_categories c on c.id = p.category_id;

grant select on public.community_posts_public_extended to anon, authenticated;

-- NOTE: After modifying schema run Supabase type generation to sync TS types:
-- npx supabase gen types typescript --project-id <your-ref> --schema public > src/types/supabase.ts

-- =====================================================================
-- MIGRATION: Switch foreign keys from auth.users(id) to public.user_profiles(user_id)
-- For existing deployments that created FKs against auth.users before this change.
-- Safe to run multiple times (each block guarded / drops use IF EXISTS).
-- =====================================================================
do $$ begin
  -- community_posts.author_id
  begin
    alter table public.community_posts drop constraint if exists community_posts_author_id_fkey;
    alter table public.community_posts add constraint community_posts_author_id_fkey foreign key (author_id) references public.user_profiles(user_id) on delete set null;
  exception when others then null; end;

  -- community_replies.author_id
  begin
    alter table public.community_replies drop constraint if exists community_replies_author_id_fkey;
    alter table public.community_replies add constraint community_replies_author_id_fkey foreign key (author_id) references public.user_profiles(user_id) on delete set null;
  exception when others then null; end;

  -- mood_entries.user_id
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='mood_entries' and column_name='user_id') then
    begin
      alter table public.mood_entries drop constraint if exists mood_entries_user_id_fkey;
      alter table public.mood_entries add constraint mood_entries_user_id_fkey foreign key (user_id) references public.user_profiles(user_id) on delete cascade;
    exception when others then null; end;
  end if;

  -- user_journal.user_id (INTENTIONALLY left without FK; see table definition rationale)
  -- Previous deployments may have had a FK; ensure it stays dropped.
  begin
    alter table public.user_journal drop constraint if exists user_journal_user_id_fkey;
  exception when others then null; end;

  -- sleep_entries.user_id
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='sleep_entries' and column_name='user_id') then
    begin
      alter table public.sleep_entries drop constraint if exists sleep_entries_user_id_fkey;
      alter table public.sleep_entries add constraint sleep_entries_user_id_fkey foreign key (user_id) references public.user_profiles(user_id) on delete cascade;
    exception when others then null; end;
  end if;

  -- chat_sessions.user_id
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='chat_sessions' and column_name='user_id') then
    begin
      alter table public.chat_sessions drop constraint if exists chat_sessions_user_id_fkey;
      alter table public.chat_sessions add constraint chat_sessions_user_id_fkey foreign key (user_id) references public.user_profiles(user_id) on delete cascade;
    exception when others then null; end;
  end if;

  -- chat_messages.user_id
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='chat_messages' and column_name='user_id') then
    begin
      alter table public.chat_messages drop constraint if exists chat_messages_user_id_fkey;
      alter table public.chat_messages add constraint chat_messages_user_id_fkey foreign key (user_id) references public.user_profiles(user_id) on delete set null;
    exception when others then null; end;
  end if;
end $$;
