/**
 * Freigabe nach Gebiet: Kantone, Bezirke und Gemeinden der Schweiz (und Liechtenstein).
 * Eine Regel pro Ebene; die genaueste gilt (Gemeinde vor Bezirk vor Kanton), ohne Regel ist geschlossen.
 * Ob eine Postleitzahl offen ist, rechnet die Datenbank (plz_open), damit Web, App und Worker dasselbe sehen.
 */
import { sql } from "@/lib/db";
import { err } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/session";
import type { Locale } from "@/lib/i18n/locale";
import { sendMail } from "@/lib/notify/mail";
import { env } from "@/lib/env";

export type AreaLevel = "canton" | "district" | "commune";
export type AreaRule = boolean | null;

export type AreaCommune = { bfs: number; name: string; district: number | null; rule: AreaRule; open: boolean; plz: string[]; members: number; waitlist: number };
export type AreaDistrict = { id: number; name: string; rule: AreaRule; open: number; total: number; members: number; waitlist: number };
export type AreaCanton = {
  code: string; name: string; rule: AreaRule;
  /** offene Gemeinden / alle Gemeinden */
  open: number; total: number;
  members: number; waitlist: number;
  districts: AreaDistrict[];
  communes: AreaCommune[];
};
export type AreasOverview = {
  cantons: AreaCanton[];
  totals: { cantonsOpen: number; cantonsPartial: number; communesOpen: number; communes: number; plzOpen: number; plz: number; members: number; waitlist: number };
  updatedAt: string | null;
};

/** Ganze Übersicht für die Verwaltung: ein Abfragelauf, etwa 2100 Gemeinden */
export async function areasOverview(): Promise<AreasOverview> {
  const [cantons, districts, communes, rules, last] = await Promise.all([
    sql<{ code: string; name: string }[]>`select code, name from geo_cantons order by name`,
    sql<{ id: number; canton: string; name: string }[]>`select id, canton, name from geo_districts order by name`,
    sql<{ bfs: number; name: string; canton: string; district_id: number | null; plz: string[]; members: number; waitlist: number }[]>`
      select c.bfs, c.name, c.canton, c.district_id,
             coalesce(array_agg(p.plz order by p.plz) filter (where p.plz is not null), '{}') as plz,
             (select count(*)::int from users u join postal_codes up on up.plz = u.plz
               where up.bfs_nr = c.bfs and u.deleted_at is null and u.onboarded_at is not null) as members,
             (select count(distinct lower(w.email))::int from plz_waitlist w join postal_codes wp on wp.plz = w.plz where wp.bfs_nr = c.bfs and w.notified_at is null) as waitlist
        from geo_communes c left join postal_codes p on p.bfs_nr = c.bfs
       group by c.bfs order by c.name`,
    sql<{ level: AreaLevel; code: string; enabled: boolean }[]>`select level, code, enabled from area_openings`,
    sql<{ at: Date | null }[]>`select max(updated_at) as at from area_openings`,
  ]);
  const rule = (level: AreaLevel, code: string | number | null): AreaRule => {
    if (code == null) return null;
    const r = rules.find((x) => x.level === level && x.code === String(code));
    return r ? r.enabled : null;
  };
  const out: AreaCanton[] = cantons.map((k) => {
    const kRule = rule("canton", k.code);
    const dist = districts.filter((d) => d.canton === k.code);
    const comm: AreaCommune[] = communes.filter((c) => c.canton === k.code).map((c) => {
      const cr = rule("commune", c.bfs);
      const dr = rule("district", c.district_id);
      return { bfs: c.bfs, name: c.name, district: c.district_id, rule: cr, open: cr ?? dr ?? kRule ?? false, plz: c.plz, members: c.members, waitlist: c.waitlist };
    });
    const sum = (xs: AreaCommune[], f: (c: AreaCommune) => number) => xs.reduce((n, c) => n + f(c), 0);
    return {
      code: k.code, name: k.name, rule: kRule,
      open: comm.filter((c) => c.open).length, total: comm.length,
      members: sum(comm, (c) => c.members), waitlist: sum(comm, (c) => c.waitlist),
      districts: dist.map((d) => {
        const dc = comm.filter((c) => c.district === d.id);
        return { id: d.id, name: d.name, rule: rule("district", d.id), open: dc.filter((c) => c.open).length, total: dc.length, members: sum(dc, (c) => c.members), waitlist: sum(dc, (c) => c.waitlist) };
      }),
      communes: comm,
    };
  });
  const all = out.flatMap((k) => k.communes);
  return {
    cantons: out,
    totals: {
      cantonsOpen: out.filter((k) => k.total > 0 && k.open === k.total).length,
      cantonsPartial: out.filter((k) => k.open > 0 && k.open < k.total).length,
      communesOpen: all.filter((c) => c.open).length,
      communes: all.length,
      plzOpen: all.filter((c) => c.open).reduce((n, c) => n + c.plz.length, 0),
      plz: all.reduce((n, c) => n + c.plz.length, 0),
      members: all.reduce((n, c) => n + c.members, 0),
      waitlist: all.reduce((n, c) => n + c.waitlist, 0),
    },
    updatedAt: last[0]?.at ? last[0].at.toISOString() : null,
  };
}

/**
 * Regel setzen: true = offen, false = geschlossen, null = Regel entfernen (erbt von oben).
 * `clearBelow`: Regeln der tieferen Ebenen innerhalb dieses Gebiets entfernen, damit der Schalter
 * für das ganze Gebiet wirkt («Ganzen Kanton öffnen»).
 */
export async function setAreaRule(mod: SessionUser, level: AreaLevel, code: string, enabled: AreaRule, clearBelow = false) {
  if (mod.role !== "admin") throw err.forbidden("Regionen und Funktionen schalten nur Admins.");
  const exists = level === "canton" ? sql`select 1 from geo_cantons where code = ${code}`
    : level === "district" ? sql`select 1 from geo_districts where id = ${Number(code) || 0}`
    : sql`select 1 from geo_communes where bfs = ${Number(code) || 0}`;
  if (!(await exists).length) throw err.notFound("Dieses Gebiet gibt es nicht.");
  await sql.begin(async (tx) => {
    if (enabled === null) await tx`delete from area_openings where level = ${level} and code = ${code}`;
    else await tx`insert into area_openings (level, code, enabled, updated_by) values (${level}, ${code}, ${enabled}, ${mod.id})
                  on conflict (level, code) do update set enabled = excluded.enabled, updated_at = now(), updated_by = excluded.updated_by`;
    if (clearBelow && level === "canton") {
      await tx`delete from area_openings where level = 'district' and code in (select id::text from geo_districts where canton = ${code})`;
      await tx`delete from area_openings where level = 'commune' and code in (select bfs::text from geo_communes where canton = ${code})`;
    }
    if (clearBelow && level === "district") {
      await tx`delete from area_openings where level = 'commune' and code in (select bfs::text from geo_communes where district_id = ${Number(code)})`;
    }
    await tx`insert into moderation_log (moderator_id, action, target_type, target_id, note)
             values (${mod.id}, ${`area_${enabled === null ? "inherit" : enabled ? "open" : "close"}`}, 'area', ${`${level}:${code}`}, ${clearBelow ? "inkl. Untergebiete" : null})`;
  });
}

const OPENED: Record<Locale, { subject: (place: string) => string; text: (place: string) => string; cta: string }> = {
  de: {
    subject: (p) => `Leihregal ist jetzt in ${p} offen`,
    text: (p) => `Gute Nachricht: Leihregal ist jetzt in ${p} offen. Du hattest dich auf die Warteliste gesetzt – jetzt kannst du dein Konto fertig einrichten, Bücher aus Regalen in deiner Nähe leihen und deine eigenen ins Regal stellen.`,
    cta: "Jetzt loslegen",
  },
  fr: {
    subject: (p) => `Leihregal est maintenant ouvert à ${p}`,
    text: (p) => `Bonne nouvelle : Leihregal est maintenant ouvert à ${p}. Tu t’étais inscrit·e sur la liste d’attente – tu peux maintenant finaliser ton compte, emprunter des livres près de chez toi et proposer les tiens.`,
    cta: "Commencer",
  },
  it: {
    subject: (p) => `Leihregal è ora aperto a ${p}`,
    text: (p) => `Buone notizie: Leihregal è ora aperto a ${p}. Ti eri iscritto/a alla lista d’attesa – ora puoi completare il tuo account, prendere in prestito libri vicino a te e mettere a disposizione i tuoi.`,
    cta: "Inizia ora",
  },
  en: {
    subject: (p) => `Leihregal is now open in ${p}`,
    text: (p) => `Good news: Leihregal is now open in ${p}. You joined the waiting list – you can now finish setting up your account, borrow books from shelves near you and put your own on the shelf.`,
    cta: "Get started",
  },
};

/** Wie lange eine Freigabe unverändert bleiben muss, bevor die Warteliste benachrichtigt wird (Schutz vor Versehen + Rückgängig) */
export const WAITLIST_GRACE_MINUTES = 10;

/**
 * Warteliste benachrichtigen: alle Einträge, deren Postleitzahl inzwischen offen ist und die noch keine
 * Nachricht bekommen haben. Erst wenn die Freigabe ihres Gebiets seit einigen Minuten unverändert ist,
 * damit ein versehentliches Öffnen mit «Rückgängig» keine E-Mails auslöst. Jede Adresse bekommt pro
 * Gemeinde genau eine E-Mail; wer inzwischen ein fertiges Konto hat, wird still als erledigt markiert.
 */
export async function notifyOpenedWaitlist(limit = 200) {
  const rows = await sql<{ email: string; locale: Locale; municipality: string; bfs: number; plzs: string[]; done: boolean }[]>`
    select w.email, (array_agg(w.locale order by w.created_at desc))[1] as locale, p.municipality, p.bfs_nr as bfs,
           array_agg(w.plz) as plzs,
           exists (select 1 from users u where lower(u.email) = w.email and u.onboarded_at is not null and u.deleted_at is null) as done
      from plz_waitlist w
      join postal_codes p on p.plz = w.plz
      join geo_communes gc on gc.bfs = p.bfs_nr
     where w.notified_at is null
       and plz_open(w.plz)
       and not exists (
         select 1 from area_openings o
          where o.updated_at > now() - make_interval(mins => ${WAITLIST_GRACE_MINUTES})
            and ((o.level = 'commune' and o.code = gc.bfs::text) or (o.level = 'district' and o.code = gc.district_id::text)
                 or (o.level = 'canton' and o.code = gc.canton)))
     group by w.email, p.municipality, p.bfs_nr
     limit ${limit}`;
  let sent = 0;
  for (const r of rows) {
    if (!r.done) {
      const m = OPENED[r.locale] ?? OPENED.de;
      await sendMail(r.email, m.subject(r.municipality), m.text(r.municipality), { href: `${env.appUrl}/anmelden`, label: m.cta }, r.locale);
      sent++;
    }
    await sql`update plz_waitlist set notified_at = now() where email = ${r.email} and plz = any(${r.plzs}) and notified_at is null`;
  }
  return { sent, handled: rows.length };
}
