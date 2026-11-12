/**
 * Ein LISTEN pro Kanal und Prozess, verteilt an alle offenen Verbindungen.
 * So braucht nicht jede offene Seite eine eigene Datenbankverbindung.
 */
import { sql } from "@/lib/db";

type Fn = (payload: string) => void;
type Entry = { fns: Set<Fn>; ready: Promise<unknown> | null };
const g = globalThis as unknown as { __leihregalLive?: Map<string, Entry> };

export async function subscribe(channel: string, fn: Fn): Promise<() => void> {
  const map = (g.__leihregalLive ??= new Map<string, Entry>());
  let e = map.get(channel);
  if (!e) {
    e = { fns: new Set(), ready: null };
    map.set(channel, e);
  }
  const entry = e;
  entry.fns.add(fn);
  if (!entry.ready) {
    entry.ready = sql
      .listen(channel, (p) => entry.fns.forEach((f) => { try { f(p); } catch {} }))
      .catch((err) => { entry.ready = null; throw err; });
  }
  try {
    await entry.ready;
  } catch (err) {
    entry.fns.delete(fn);
    throw err;
  }
  return () => { entry.fns.delete(fn); };
}
