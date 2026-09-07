-- Scale optimisation for classrooms of up to 120 concurrent players.
-- Consolidates the student refresh path to one RPC per control event.

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
    'participantCount', (select count(*) from public.bp_players where room_id = p_room_id),
    'score', (select count(*) from public.bp_answers where player_id = p_player_id and is_correct),
    'answeredRounds', (select count(*) from public.bp_answers where player_id = p_player_id),
    'currentAnswer', (select answer from public.bp_answers where player_id = p_player_id and round_no = v_room.current_round),
    'currentCorrect', case when v_room.revealed then
      (select is_correct from public.bp_answers where player_id = p_player_id and round_no = v_room.current_round)
      else null end
  );
end;
$$;

revoke execute on function public.bp_player_state(uuid,uuid,uuid) from authenticated;
grant execute on function public.bp_player_state(uuid,uuid,uuid) to anon;

-- Helps player-state lookups remain cheap when answer volume grows.
create index if not exists bp_answers_player_round_idx
  on public.bp_answers(player_id, round_no);
