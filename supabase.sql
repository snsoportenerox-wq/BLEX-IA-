-- Ejecutar en Supabase > SQL Editor.
-- Firebase valida Google. Supabase Auth valida Discord.
-- Supabase Database almacena perfiles, registros de acceso y límites de uso.

create table if not exists public.blex_profiles (
  user_id text primary key,
  provider text not null check (provider in ('google', 'discord')),
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists public.blex_login_events (
  id bigint generated always as identity primary key,
  user_id text not null,
  provider text not null check (provider in ('google', 'discord')),
  email text,
  logged_in_at timestamptz not null default now()
);

create index if not exists blex_login_events_user_date_idx
  on public.blex_login_events(user_id, logged_in_at desc);

create table if not exists public.daily_usage (
  user_id text not null,
  usage_date date not null default (now() at time zone 'utc')::date,
  message_count integer not null default 0 check (message_count between 0 and 300),
  image_count integer not null default 0 check (image_count between 0 and 10),
  primary key (user_id, usage_date)
);

alter table public.blex_profiles enable row level security;
alter table public.blex_login_events enable row level security;
alter table public.daily_usage enable row level security;

-- Las escrituras se realizan desde el servidor con la clave secreta.
-- No se habilita acceso público directo a estos registros.
revoke all on public.blex_profiles from anon, authenticated;
revoke all on public.blex_login_events from anon, authenticated;
revoke all on public.daily_usage from anon, authenticated;

create or replace function public.consume_blex_usage(
  p_user_id text,
  p_messages integer default 0,
  p_images integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.daily_usage%rowtype;
  today_utc date := (now() at time zone 'utc')::date;
begin
  if p_user_id is null or length(p_user_id) < 3
     or p_messages < 0 or p_images < 0
     or p_messages > 1 or p_images > 10 then
    raise exception 'invalid_usage';
  end if;

  insert into public.daily_usage(user_id, usage_date)
  values (p_user_id, today_utc)
  on conflict (user_id, usage_date) do nothing;

  select * into current_row
  from public.daily_usage
  where user_id = p_user_id and usage_date = today_utc
  for update;

  if current_row.message_count + p_messages > 300 then
    return jsonb_build_object('allowed', false, 'reason', 'messages',
      'messages', current_row.message_count, 'images', current_row.image_count);
  end if;
  if current_row.image_count + p_images > 10 then
    return jsonb_build_object('allowed', false, 'reason', 'images',
      'messages', current_row.message_count, 'images', current_row.image_count);
  end if;

  update public.daily_usage
  set message_count = message_count + p_messages,
      image_count = image_count + p_images
  where user_id = p_user_id and usage_date = today_utc
  returning * into current_row;

  return jsonb_build_object('allowed', true,
    'messages', current_row.message_count, 'images', current_row.image_count);
end;
$$;

revoke all on function public.consume_blex_usage(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_blex_usage(text, integer, integer) to service_role;
