import { z } from "zod";
import { body, query, route } from "@/lib/api";
import { areasOverview, setAreaRule } from "@/lib/areas";
import { requireModerator } from "@/lib/auth/session";
import * as mod from "@/lib/moderation";
import { correctionCurrent, targetLinks } from "@/lib/moderation-queries";
import { setPrice } from "@/lib/billing";

/**
 * GET /api/v1/mod?view=queue|kpis|flags|log|users|team&q= – interne Werkzeuge.
 * Die Warteschlange enthält für Apps zusätzlich `href` (Ziel einer Meldung als Web-Pfad) und
 * `current` (heutiger Wert bei Katalogkorrekturen) – dieselben Angaben, die das Web anzeigt.
 */
export const GET = route(async (req) => {
  await requireModerator();
  const q = query(req, z.object({ view: z.enum(["queue", "kpis", "flags", "areas", "log", "users", "team"]), q: z.string().max(100).optional() }));
  switch (q.view) {
    case "queue": {
      const r = await mod.queue();
      const [links, current] = await Promise.all([
        targetLinks(r.reports),
        correctionCurrent(r.corrections.map((c) => c.id)),
      ]);
      return {
        ...r,
        reports: r.reports.map((x) => ({ ...x, href: links[`${x.target_type}:${x.target_id}`] ?? null })),
        corrections: r.corrections.map((x) => ({ ...x, current: current[x.id] ?? null })),
      };
    }
    case "kpis": return mod.kpis();
    case "flags": return { flags: await mod.flags() };
    case "areas": return await areasOverview();
    case "log": {
      const log = (await mod.moderationLog()) as unknown as { target_type: string; target_id: string }[];
      const links = await targetLinks(log);
      return { log: log.map((x) => ({ ...x, href: links[`${x.target_type}:${x.target_id}`] ?? null })) };
    }
    case "users": return { users: await mod.findUsers(q.q ?? "") };
    case "team": return { team: await mod.team() };
  }
});

/** POST /api/v1/mod – Entscheidungen der Moderation */
export const POST = route(async (req) => {
  const m = await requireModerator();
  const b = await body(
    req,
    z.discriminatedUnion("action", [
      z.object({ action: z.literal("decide_case"), caseId: z.string().uuid(), decision: z.enum(["returned", "replaced", "rejected", "lost"]), note: z.string().max(1000).optional() }),
      z.object({ action: z.literal("report"), reportId: z.string().uuid(), status: z.enum(["actioned", "dismissed"]), note: z.string().max(1000).optional() }),
      z.object({ action: z.literal("ban"), userId: z.string().uuid(), banned: z.boolean(), reason: z.string().max(300).optional() }),
      z.object({ action: z.literal("suspend"), userId: z.string().uuid(), suspended: z.boolean() }),
      z.object({ action: z.literal("remove_avatar"), userId: z.string().uuid(), note: z.string().max(300).optional() }),
      z.object({ action: z.literal("correction"), id: z.string().uuid(), apply: z.boolean() }),
      z.object({ action: z.literal("flag"), key: z.string().max(40), regionId: z.string().max(40).optional(), enabled: z.boolean() }),
      z.object({ action: z.literal("area"), level: z.enum(["canton", "district", "commune"]), code: z.string().max(10), enabled: z.boolean().nullable(), clearBelow: z.boolean().optional() }),
      z.object({ action: z.literal("role"), userId: z.string().uuid(), role: z.enum(["member", "moderator"]) }),
      z.object({ action: z.literal("hide_content"), targetType: z.enum(mod.HIDEABLE), targetId: z.string().uuid(), hidden: z.boolean(), note: z.string().max(300).optional() }),
      z.object({ action: z.literal("temp_password"), userId: z.string().uuid() }),
      z.object({ action: z.literal("price"), key: z.enum(["supporter_month", "supporter_year", "org_month", "shipping_fee"]), amount: z.number().int().min(0).max(100000) }),
    ]),
  );
  switch (b.action) {
    case "decide_case": await mod.decideCase(m, b.caseId, b.decision, b.note); break;
    case "report": await mod.handleReport(m, b.reportId, b.status, b.note); break;
    case "ban": await mod.setBan(m, b.userId, b.banned, b.reason); break;
    case "suspend": await mod.setSuspension(m, b.userId, b.suspended); break;
    case "remove_avatar": await mod.removeAvatar(m, b.userId, b.note); break;
    case "correction": await mod.applyCorrection(m, b.id, b.apply); break;
    case "flag": await mod.setFlag(m, b.key, b.enabled); break;
    case "area": await setAreaRule(m, b.level, b.code, b.enabled, b.clearBelow); break;
    case "role": await mod.setRole(m, b.userId, b.role); break;
    case "hide_content": await mod.hideContent(m, b.targetType, b.targetId, b.hidden, b.note); break;
    case "temp_password": return { ok: true, password: await mod.temporaryPassword(m, b.userId) };
    case "price": await setPrice(m, b.key, b.amount); break;
  }
  return { ok: true };
});
