/** Profil (PRD 4.7, 8.4): drei Zahlen, Stufe, Regal. Keine Sterne, keine Punkte, keine Abzeichen. */
import { sql } from "@/lib/db";

export type PublicProfile = {
  id: string;
  first_name: string;
  municipality: string | null;
  trust_level: number;
  member_since: Date;
  lent: number;
  borrowed: number;
  punctual_pct: number | null;
  visible_losses: number;
  good_ratings: number;
  problem_ratings: number;
  median_response_hours: number | null;
  shared_circles: string[];
  blocked_by_me: boolean;
  deleted: boolean;
};

export async function publicProfile(userId: string, viewerId: string | null): Promise<PublicProfile | null> {
  const [p] = await sql<PublicProfile[]>`
    select u.id, u.first_name, u.municipality, u.trust_level, u.created_at as member_since,
           s.lent_count::int as lent, s.borrowed_count::int as borrowed,
           case when s.rated_count > 0 then round(100.0 * s.punctual_count / s.rated_count)::int end as punctual_pct,
           s.visible_losses::int as visible_losses,
           (select count(*)::int from ratings r where r.for_user = u.id and r.verdict = 'good' and r.visible_from <= now()) as good_ratings,
           (select count(*)::int from ratings r where r.for_user = u.id and r.verdict = 'problems' and r.visible_from <= now()) as problem_ratings,
           round((s.median_response_seconds / 3600)::numeric, 1)::float8 as median_response_hours,
           array(select c.name from circles c
                   join circle_members a on a.circle_id = c.id and a.user_id = u.id and a.status = 'active'
                   join circle_members b on b.circle_id = c.id and b.user_id = ${viewerId}::uuid and b.status = 'active') as shared_circles,
           exists (select 1 from blocks where blocker_id = ${viewerId}::uuid and blocked_id = u.id) as blocked_by_me,
           u.deleted_at is not null as deleted
      from users u join user_stats s on s.user_id = u.id
     where u.id = ${userId}
       and not exists (select 1 from blocks where blocker_id = u.id and blocked_id = ${viewerId}::uuid)`;
  return p ?? null;
}
