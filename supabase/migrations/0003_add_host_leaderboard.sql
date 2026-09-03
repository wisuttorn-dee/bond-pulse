-- Instructor-only leaderboard for each Bond Pulse room.
-- Rankings use score only. Speed is deliberately not used as a tiebreaker.

create or replace function public.bp_host_leaderboard(p_room_id uuid, p_host_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.bp_rooms
    where id = p_room_id and host_token = p_host_token
  ) then
    raise exception 'HOST_NOT_AUTHORISED';
  end if;

  return coalesce((
    with player_stats as (
      select
        p.id,
        p.nickname,
        p.joined_at,
        count(a.*)::int as answered,
        count(a.*) filter (where a.is_correct)::int as score
      from public.bp_players p
      left join public.bp_answers a on a.player_id = p.id
      where p.room_id = p_room_id
      group by p.id, p.nickname, p.joined_at
    ), ranked as (
      select
        dense_rank() over (order by score desc)::int as rank,
        nickname,
        score,
        answered,
        (answered = 5) as completed,
        joined_at
      from player_stats
    )
    select jsonb_agg(
      jsonb_build_object(
        'rank', rank,
        'nickname', nickname,
        'score', score,
        'answered', answered,
        'completed', completed
      )
      order by score desc, answered desc, joined_at asc
    )
    from ranked
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.bp_host_leaderboard(uuid,uuid) from public, authenticated;
grant execute on function public.bp_host_leaderboard(uuid,uuid) to anon;
