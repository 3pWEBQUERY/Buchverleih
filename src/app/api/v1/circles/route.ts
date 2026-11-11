import { z } from "zod";
import { body, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { createCircle, myCircles } from "@/lib/circles";

const settings = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(280).nullish(),
  loanDays: z.union([z.literal(14), z.literal(28), z.literal(42), z.literal(56)]).optional(),
  autoAccept: z.boolean().optional(),
  fixedSpot: z.string().max(80).nullish(),
  joinMode: z.enum(["link", "approval"]).optional(),
});

export const GET = route(async () => ({ circles: await myCircles((await requireUser()).id) }));

export const POST = route(async (req) => {
  const u = await requireUser();
  return { id: await createCircle(u.id, await body(req, settings)) };
});
