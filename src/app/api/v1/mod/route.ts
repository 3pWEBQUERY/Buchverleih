import { z } from "zod";
import { body, query, route } from "@/lib/api";
import { requireModerator } from "@/lib/auth/session";
import * as mod from "@/lib/moderation";

/** GET /api/v1/mod?view=queue|kpis|flags|log|users&q= – interne Werkzeuge */
export const GET = route(async (req) => {
  await requireModerator();
  const q = query(req, z.object({ view: z.enum(["queue", "kpis", "flags", "log", "users"]), q: z.string().max(100).optional() }));
  switch (q.view) {
    case "queue": return mod.queue();
    case "kpis": return mod.kpis();
    case "flags": return { flags: await mod.flags() };
    case "log": return { log: await mod.moderationLog() };
    case "users": return { users: await mod.findUsers(q.q ?? "") };
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
      z.object({ action: z.literal("correction"), id: z.string().uuid(), apply: z.boolean() }),
      z.object({ action: z.literal("flag"), key: z.string().max(40), regionId: z.string().max(40), enabled: z.boolean() }),
    ]),
  );
  switch (b.action) {
    case "decide_case": await mod.decideCase(m, b.caseId, b.decision, b.note); break;
    case "report": await mod.handleReport(m, b.reportId, b.status, b.note); break;
    case "ban": await mod.setBan(m, b.userId, b.banned, b.reason); break;
    case "suspend": await mod.setSuspension(m, b.userId, b.suspended); break;
    case "correction": await mod.applyCorrection(m, b.id, b.apply); break;
    case "flag": await mod.setFlag(m, b.key, b.regionId, b.enabled); break;
  }
  return { ok: true };
});
