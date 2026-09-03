-- Bond Pulse classroom game schema
-- No-registration classroom use with unguessable capability tokens.

create extension if not exists pgcrypto;

create table if not exists public.bp_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[0-9]{6}$'),
  host_token uuid not null default gen_random_uuid(),
  status text not null default 'lobby' check (status in ('lobby','playing','finished')),
  current_round integer not null default 0 check (current_round between 0 and 5),
  revealed boolean not null default false,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.bp_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.bp_rooms(id) on delete cascade,
  nickname text not null check (char_length(trim(nickname)) between 1 and 24),
  player_token uuid not null default gen_random_uuid(),
  joined_at timestamptz not null default now(),
  unique(room_id, player_token)
);

create unique index if not exists bp_players_room_nickname_ci
  on public.bp_players(room_id, lower(trim(nickname)));

create table if not exists public.bp_answers (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.bp_rooms(id) on delete cascade,
  player_id uuid not null references public.bp_players(id) on delete cascade,
  round_no integer not null check (round_no between 1 and 5),
  answer text not null check (answer in ('up','down','par')),
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  unique(player_id, round_no)
);

alter table public.bp_rooms enable row level security;
alter table public.bp_players enable row level security;
alter table public.bp_answers enable row level security;

-- Browser clients do not access tables directly. All access is through RPCs below.
revoke all on table public.bp_rooms from anon, authenticated;
revoke all on table public.bp_players from anon, authenticated;
revoke all on table public.bp_answers from anon, authenticated;

create or replace function public.bp_correct_answer(p_round integer)
returns text
language sql
immutable
as $$
  select case p_round
    when 1 then 'down'
    when 2 then 'up'
    when 3 then 'par'
    when 4 then 'down'
    when 5 then 'up'
  end;
$$;

create or replace function public.bp_create_room()
returns table(room_id uuid, room_code text, host_token uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
  v_id uuid;
  v_token uuid;
begin
  loop
    v_code := lpad((floor(random()*1000000))::int::text, 6, '0');
    begin
      insert into public.bp_rooms(code)
      values (v_code)
      returning id, bp_rooms.host_token into v_id, v_token;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;
  return query select v_id, v_code, v_token;
end;
$$;

create or replace function public.bp_join_room(p_code text, p_nickname text)
returns table(room_id uuid, room_code text, player_id uuid, player_token uuid, status text, current_round integer, revealed boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room public.bp_rooms%rowtype;
  v_player public.bp_players%rowtype;
  v_name text := trim(p_nickname);
begin
  if char_length(v_name) < 1 or char_length(v_name) > 24 then
    raise exception 'INVALID_NICKNAME';
  end if;

  select r.* into v_room
  from public.bp_rooms r
  where r.code = trim(p_code) and r.status <> 'finished';

  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  begin
    insert into public.bp_players(room_id, nickname)
    values (v_room.id, v_name)
    returning * into v_player;
  exception when unique_violation then
    raise exception 'NICKNAME_TAKEN';
  end;

  return query select v_room.id, v_room.code, v_player.id, v_player.player_token,
    v_room.status, v_room.current_round, v_room.revealed;
end;
$$;

create or replace function public.bp_room_state(p_code text)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'roomId', r.id,
    'code', r.code,
    'status', r.status,
    'currentRound', r.current_round,
    'revealed', r.revealed,
    'participantCount', (select count(*) from public.bp_players p where p.room_id = r.id),
    'answeredCount', (select count(*) from public.bp_answers a where a.room_id = r.id and a.round_no = r.current_round)
  )
  from public.bp_rooms r where r.code = trim(p_code);
$$;

create or replace function public.bp_player_state(p_room_id uuid, p_player_id uuid, p_player_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room public.bp_rooms%rowtype;
  v_ok boolean;
begin
  select exists(
    select 1 from public.bp_players
    where id = p_player_id and room_id = p_room_id and player_token = p_player_token
  ) into v_ok;
  if not v_ok then raise exception 'PLAYER_NOT_AUTHORISED'; end if;

  select * into v_room from public.bp_rooms where id = p_room_id;

  return jsonb_build_object(
    'status', v_room.status,
    'currentRound', v_room.current_round,
    'revealed', v_room.revealed,
    'score', (select count(*) from public.bp_answers where player_id = p_player_id and is_correct),
    'answeredRounds', (select count(*) from public.bp_answers where player_id = p_player_id),
    'currentAnswer', (select answer from public.bp_answers where player_id = p_player_id and round_no = v_room.current_round),
    'currentCorrect', case when v_room.revealed then
      (select is_correct from public.bp_answers where player_id = p_player_id and round_no = v_room.current_round)
      else null end
  );
end;
$$;

create or replace function public.bp_submit_answer(
  p_room_id uuid,
  p_player_id uuid,
  p_player_token uuid,
  p_round integer,
  p_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room public.bp_rooms%rowtype;
  v_ok boolean;
  v_correct boolean;
begin
  select exists(
    select 1 from public.bp_players
    where id = p_player_id and room_id = p_room_id and player_token = p_player_token
  ) into v_ok;
  if not v_ok then raise exception 'PLAYER_NOT_AUTHORISED'; end if;

  select * into v_room from public.bp_rooms where id = p_room_id for update;
  if v_room.status <> 'playing' or v_room.current_round <> p_round or v_room.revealed then
    raise exception 'ROUND_CLOSED';
  end if;
  if p_answer not in ('up','down','par') then raise exception 'INVALID_ANSWER'; end if;

  v_correct := p_answer = public.bp_correct_answer(p_round);
  insert into public.bp_answers(room_id, player_id, round_no, answer, is_correct)
  values (p_room_id, p_player_id, p_round, p_answer, v_correct)
  on conflict (player_id, round_no) do nothing;

  return public.bp_player_state(p_room_id, p_player_id, p_player_token);
end;
$$;

create or replace function public.bp_host_state(p_room_id uuid, p_host_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room public.bp_rooms%rowtype;
  v_total bigint;
  v_total_answers bigint;
  v_total_correct bigint;
begin
  select * into v_room from public.bp_rooms where id = p_room_id and host_token = p_host_token;
  if not found then raise exception 'HOST_NOT_AUTHORISED'; end if;

  select count(*) into v_total from public.bp_players where room_id = p_room_id;
  select count(*), count(*) filter(where is_correct)
    into v_total_answers, v_total_correct
  from public.bp_answers where room_id = p_room_id;

  return jsonb_build_object(
    'roomId', v_room.id,
    'code', v_room.code,
    'status', v_room.status,
    'currentRound', v_room.current_round,
    'revealed', v_room.revealed,
    'participantCount', v_total,
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'nickname', p.nickname,
        'answered', (select count(*) from public.bp_answers a where a.player_id = p.id)
      ) order by p.joined_at)
      from public.bp_players p where p.room_id = p_room_id
    ), '[]'::jsonb),
    'currentDistribution', jsonb_build_object(
      'up', (select count(*) from public.bp_answers where room_id = p_room_id and round_no = v_room.current_round and answer = 'up'),
      'down', (select count(*) from public.bp_answers where room_id = p_room_id and round_no = v_room.current_round and answer = 'down'),
      'par', (select count(*) from public.bp_answers where room_id = p_room_id and round_no = v_room.current_round and answer = 'par')
    ),
    'currentAnswered', (select count(*) from public.bp_answers where room_id = p_room_id and round_no = v_room.current_round),
    'currentCorrect', (select count(*) from public.bp_answers where room_id = p_room_id and round_no = v_room.current_round and is_correct),
    'overallAccuracy', case when v_total_answers = 0 then 0
      else round((v_total_correct::numeric / v_total_answers::numeric) * 100, 1) end,
    'roundAccuracy', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'round', x.round_no,
        'answered', x.answered,
        'correct', x.correct,
        'accuracy', x.accuracy
      ) order by x.round_no), '[]'::jsonb)
      from (
        select gs as round_no,
          count(a.*) as answered,
          count(a.*) filter(where a.is_correct) as correct,
          case when count(a.*) = 0 then 0
            else round((count(a.*) filter(where a.is_correct)::numeric / count(a.*)::numeric) * 100, 1) end as accuracy
        from generate_series(1,5) gs
        left join public.bp_answers a on a.room_id = p_room_id and a.round_no = gs
        group by gs
      ) x
    ),
    'completedAll', (
      select count(*) from (
        select player_id from public.bp_answers where room_id = p_room_id
        group by player_id having count(*) = 5
      ) q
    )
  );
end;
$$;

create or replace function public.bp_host_action(p_room_id uuid, p_host_token uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room public.bp_rooms%rowtype;
begin
  select * into v_room from public.bp_rooms
  where id = p_room_id and host_token = p_host_token
  for update;
  if not found then raise exception 'HOST_NOT_AUTHORISED'; end if;

  if p_action = 'start' then
    if v_room.status <> 'lobby' then raise exception 'INVALID_STATE'; end if;
    update public.bp_rooms set status = 'playing', current_round = 1, revealed = false where id = p_room_id;
  elsif p_action = 'reveal' then
    if v_room.status <> 'playing' then raise exception 'INVALID_STATE'; end if;
    update public.bp_rooms set revealed = true where id = p_room_id;
  elsif p_action = 'next' then
    if v_room.status <> 'playing' or not v_room.revealed then raise exception 'INVALID_STATE'; end if;
    if v_room.current_round >= 5 then
      update public.bp_rooms set status = 'finished', ended_at = now(), revealed = true where id = p_room_id;
    else
      update public.bp_rooms set current_round = current_round + 1, revealed = false where id = p_room_id;
    end if;
  elsif p_action = 'end' then
    update public.bp_rooms set status = 'finished', ended_at = now(), revealed = true where id = p_room_id;
  else
    raise exception 'INVALID_ACTION';
  end if;

  return public.bp_host_state(p_room_id, p_host_token);
end;
$$;

-- SECURITY DEFINER is intentionally used because direct table access is revoked.
-- Each privileged RPC validates a per-room or per-player capability token.
revoke execute on all functions in schema public from public;
grant execute on function public.bp_create_room() to anon, authenticated;
grant execute on function public.bp_join_room(text,text) to anon, authenticated;
grant execute on function public.bp_room_state(text) to anon, authenticated;
grant execute on function public.bp_player_state(uuid,uuid,uuid) to anon, authenticated;
grant execute on function public.bp_submit_answer(uuid,uuid,uuid,integer,text) to anon, authenticated;
grant execute on function public.bp_host_action(uuid,uuid,text) to anon, authenticated;
grant execute on function public.bp_host_state(uuid,uuid) to anon, authenticated;
