-- Ejecuta este archivo en Supabase > SQL Editor.
-- Supabase Auth administra los inicios de sesión y las sesiones.
-- Esta tabla almacena contadores diarios por usuario.

create table if not exists public.daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default (now() at time zone 'utc')::date,
  message_count integer not null default 0 check (message_count between 0 and 300),
  image_count integer not null default 0 check (image_count between 0 and 10),
  primary key (user_id, usage_date)
);

alter table public.daily_usage enable row level security;

-- El cliente no puede modificar los contadores directamente.
revoke all on public.daily_usage from anon, authenticated;
grant select on public.daily_usage to authenticated;

drop policy if exists "Users can read own daily usage" on public.daily_usage;
create policy "Users can read own daily usage"
on public.daily_usage for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.consume_blex_usage(
  p_user_id uuid,
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
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'not_authorized';
  end if;

  if p_messages < 0 or p_images < 0 or p_messages > 1 or p_images > 10 then
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

revoke all on function public.consume_blex_usage(uuid, integer, integer) from public;
grant execute on function public.consume_blex_usage(uuid, integer, integer) to authenticated;
