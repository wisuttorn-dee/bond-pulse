-- Security and performance hardening after Supabase advisor review.

alter function public.bp_correct_answer(integer)
  set search_path = public, pg_temp;

-- This app intentionally uses the unauthenticated anon role only.
-- Remove unnecessary RPC execution from authenticated users.
revoke execute on function public.bp_create_room() from authenticated;
revoke execute on function public.bp_join_room(text,text) from authenticated;
revoke execute on function public.bp_room_state(text) from authenticated;
revoke execute on function public.bp_player_state(uuid,uuid,uuid) from authenticated;
revoke execute on function public.bp_submit_answer(uuid,uuid,uuid,integer,text) from authenticated;
revoke execute on function public.bp_host_action(uuid,uuid,text) from authenticated;
revoke execute on function public.bp_host_state(uuid,uuid) from authenticated;

-- Covers the room foreign key and the most frequent round aggregation queries.
create index if not exists bp_answers_room_round_idx
  on public.bp_answers(room_id, round_no);
