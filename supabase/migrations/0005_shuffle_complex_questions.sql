-- Bond Pulse: shuffled complex question set.
-- The six-digit room code deterministically selects one of ten permutations,
-- so host and all students in the same room always see the same order.

create or replace function public.bp_question_id_for_round(p_code text, p_round integer)
returns integer
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_digit integer;
  v_order integer[];
begin
  if p_round < 1 or p_round > 5 then return null; end if;
  v_digit := right(trim(p_code), 1)::integer;
  v_order := case v_digit
    when 0 then array[1,4,2,5,3]
    when 1 then array[2,5,1,4,3]
    when 2 then array[4,1,3,5,2]
    when 3 then array[5,2,4,1,3]
    when 4 then array[3,1,5,2,4]
    when 5 then array[1,5,3,4,2]
    when 6 then array[2,4,5,3,1]
    when 7 then array[4,3,1,2,5]
    when 8 then array[5,3,2,1,4]
    else array[3,2,4,5,1]
  end;
  return v_order[p_round];
end;
$$;

create or replace function public.bp_question_correct_answer(p_question_id integer)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_question_id
    when 1 then 'down'
    when 2 then 'up'
    when 3 then 'par'
    when 4 then 'down'
    when 5 then 'up'
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
  v_question_id integer;
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

  v_question_id := public.bp_question_id_for_round(v_room.code, p_round);
  v_correct := p_answer = public.bp_question_correct_answer(v_question_id);

  insert into public.bp_answers(room_id, player_id, round_no, answer, is_correct)
  values (p_room_id, p_player_id, p_round, p_answer, v_correct)
  on conflict (player_id, round_no) do nothing;

  return public.bp_player_state(p_room_id, p_player_id, p_player_token);
end;
$$;

revoke execute on function public.bp_question_id_for_round(text,integer) from public, anon, authenticated;
revoke execute on function public.bp_question_correct_answer(integer) from public, anon, authenticated;
revoke execute on function public.bp_submit_answer(uuid,uuid,uuid,integer,text) from authenticated;
grant execute on function public.bp_submit_answer(uuid,uuid,uuid,integer,text) to anon;
