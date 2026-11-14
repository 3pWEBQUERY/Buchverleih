/**
 * Leihablauf gegen echtes Postgres: Constraints, Zustandswechsel, Kalender.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "@/lib/db";
import * as svc from "@/lib/loans/service";
import { createToken, redeemCode, redeemToken } from "@/lib/loans/handover";
import { passOnConsent } from "@/lib/loans/passon";
import { getCalendar } from "@/lib/loans/calendar";
import { ageLoan, day, makeCopy, makeUser, reset, status } from "./helpers";

beforeEach(reset);
afterAll(() => sql.end());

describe("Leihe von Anfrage bis Abschluss", () => {
  it("läuft vollständig mit QR-Übergabe und QR-Rückgabe", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const copy = await makeCopy(marc, "Der Prozess");

    const loan = await svc.requestLoan(lea, { copyId: copy, kind: "lend", message: "Hallo" });
    expect(loan.status).toBe("requested");
    await svc.accept(marc, loan.id, {});
    expect(await status(loan.id)).toBe("accepted");

    // Marc zeigt den Code, Lea scannt
    const t = await createToken(marc, loan.id);
    expect(t.code).toMatch(/^\d{6}$/);
    await expect(redeemToken(marc, t.token)).rejects.toThrow(/andere/);
    const r = await redeemToken(lea, t.token);
    expect(r.status).toBe("active");
    await expect(redeemToken(lea, t.token)).rejects.toThrow(/bereits verwendet/);

    const [l] = await sql<{ due_at: Date; handed_over_at: Date }[]>`select due_at, handed_over_at from loans where id = ${loan.id}`;
    expect(l.due_at.getTime()).toBeGreaterThan(Date.now() + 27 * 86400_000);

    // Rückgabe: Lea zeigt den Code, Marc gibt die sechs Ziffern ein
    const rt = await createToken(lea, loan.id);
    await expect(redeemCode(marc, loan.id, "000000" === rt.code ? "111111" : "000000")).rejects.toThrow(/Ziffern/);
    await redeemCode(marc, loan.id, rt.code);
    expect(await status(loan.id)).toBe("returned");

    await svc.complete(marc, loan.id);
    expect(await status(loan.id)).toBe("completed");

    const events = await sql<{ action: string }[]>`select action from loan_events where loan_id = ${loan.id} order by id`;
    expect(events.map((e) => e.action)).toEqual(["request", "accept", "handover", "return", "complete"]);
    await expect(sql`update loan_events set action = 'x' where loan_id = ${loan.id}`).rejects.toThrow(/anhängend/);

    await svc.rate(lea, loan.id, { verdict: "good", reasons: [] });
    await svc.rate(marc, loan.id, { verdict: "good", reasons: [] });
    const [rv] = await sql<{ n: number }[]>`select count(*)::int as n from ratings where loan_id = ${loan.id} and visible_from <= now()`;
    expect(rv.n).toBe(2);
  });

  it("zwei gleichzeitige Annahmen: nur eine gewinnt", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const copy = await makeCopy(marc, "Stiller");
    const loan = await svc.requestLoan(lea, { copyId: copy, kind: "lend" });
    const results = await Promise.allSettled([svc.accept(marc, loan.id, {}), svc.accept(marc, loan.id, {})]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const [b] = await sql<{ n: number }[]>`select count(*)::int as n from copy_bookings where loan_id = ${loan.id}`;
    expect(b.n).toBe(1);
  });

  it("doppelte Anfrage für denselben Starttag scheitert an der Datenbank", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const copy = await makeCopy(marc, "Homo faber");
    await svc.requestLoan(lea, { copyId: copy, kind: "lend" });
    await expect(svc.requestLoan(lea, { copyId: copy, kind: "lend" })).rejects.toMatchObject({ code: "23505" });
  });
});

describe("Verleihkalender", () => {
  it("überlappende oder zu dicht anschliessende Buchung scheitert (23P01), Puffer zählt", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const jonas = await makeUser("Jonas");
    const copy = await makeCopy(marc, "Die Wand");
    const a = await svc.requestLoan(lea, { copyId: copy, kind: "lend", start: day(0), end: day(28) });
    await svc.accept(marc, a.id, {});

    // Direkt danach ohne Puffer: abgelehnt bereits bei der Anfrage
    await expect(svc.requestLoan(jonas, { copyId: copy, kind: "lend", start: day(29), end: day(40) })).rejects.toMatchObject({ code: "calendar_conflict" });
    // Auf Datenbankebene ebenso
    await expect(
      sql`insert into copy_bookings (copy_id, period, buffer_days) values (${copy}, daterange(${day(29)}::date, ${day(35)}::date), 0)`,
    ).rejects.toMatchObject({ code: "23P01" });

    // Nach dem Puffer von 3 Tagen: frei
    const b = await svc.requestLoan(jonas, { copyId: copy, kind: "lend", start: day(31), end: day(45) });
    await svc.accept(marc, b.id, {});

    const cal = await getCalendar(sql, copy, jonas.id);
    expect(cal!.bars).toHaveLength(2);
    expect(cal!.bars.find((x) => x.mine)?.start).toBe(day(31));
    expect(cal!.bars.every((x) => x.name === null)).toBe(true);
    const own = await getCalendar(sql, copy, marc.id);
    expect(own!.bars.map((x) => x.name)).toEqual(["Lea", "Jonas"]);
  });

  it("aktiv ohne Übergabezeitpunkt scheitert (23514)", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const copy = await makeCopy(marc, "Momo");
    const l = await svc.requestLoan(lea, { copyId: copy, kind: "lend" });
    await expect(sql`update loans set status = 'active' where id = ${l.id}`).rejects.toMatchObject({ code: "23514" });
  });

  it("Verlängerung nur bis zum Puffer vor der nächsten Buchung", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const jonas = await makeUser("Jonas");
    const copy = await makeCopy(marc, "Siddhartha");
    const a = await svc.requestLoan(lea, { copyId: copy, kind: "lend", start: day(0), end: day(20) });
    await svc.accept(marc, a.id, {});
    const b = await svc.requestLoan(jonas, { copyId: copy, kind: "lend", start: day(30), end: day(40) });
    await svc.accept(marc, b.id, {});
    const t = await createToken(marc, a.id);
    await redeemToken(lea, t.token);
    await svc.extend(lea, a.id);
    const [bk] = await sql<{ end: string }[]>`select upper(period)::text as end from copy_bookings where loan_id = ${a.id}`;
    expect(bk.end).toBe(day(27)); // 30 minus 3 Tage Puffer, nicht 34
    await expect(svc.extend(lea, a.id)).rejects.toMatchObject({ code: "no_extensions" });
  });
});

describe("Limiten und Vertrauen", () => {
  it("Neue haben höchstens 3 offene Anfragen", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    for (let i = 0; i < 3; i++) await svc.requestLoan(lea, { copyId: await makeCopy(marc, `Buch ${i}`), kind: "lend" });
    await expect(svc.requestLoan(lea, { copyId: await makeCopy(marc, "Buch 4"), kind: "lend" })).rejects.toMatchObject({ code: "limit_requests" });
  });

  it("Sichtbarkeit «ab Bewährt» versteckt das Buch vor Neuen", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const anna = await makeUser("Anna", { trust: 1 });
    const copy = await makeCopy(marc, "Andorra", { visibility: "proven" });
    await expect(svc.requestLoan(lea, { copyId: copy, kind: "lend" })).rejects.toMatchObject({ code: "not_found" });
    await expect(svc.requestLoan(anna, { copyId: copy, kind: "lend" })).resolves.toBeTruthy();
  });
});

describe("Tausch und Geschenk", () => {
  it("Tausch: beide Scans innert 10 Minuten, Exemplare wechseln den Besitzer", async () => {
    const jonas = await makeUser("Jonas");
    const lea = await makeUser("Lea");
    const his = await makeCopy(jonas, "Der Steppenwolf", { offers: "{swap}" });
    const hers1 = await makeCopy(lea, "Effi Briest", { offers: "{swap}" });
    const hers2 = await makeCopy(lea, "Der Vorleser", { offers: "{swap}" });
    const loan = await svc.requestLoan(lea, { copyId: his, kind: "swap", swapOfferedCopyIds: [hers1, hers2] });
    await expect(svc.accept(jonas, loan.id, {})).rejects.toMatchObject({ code: "invalid" });
    await svc.accept(jonas, loan.id, { swapCopyId: hers2 });

    const tj = await createToken(jonas, loan.id);
    const first = await redeemToken(lea, tj.token);
    expect(first.waitingForOther).toBe(true);
    const tl = await createToken(lea, loan.id);
    const second = await redeemToken(jonas, tl.token);
    expect(second.status).toBe("completed");

    const owners = await sql<{ id: string; owner_id: string; offers: string }[]>`select id, owner_id, offers::text from copies where id in (${his}, ${hers2})`;
    expect(owners.find((c) => c.id === his)!.owner_id).toBe(lea.id);
    expect(owners.find((c) => c.id === hers2)!.owner_id).toBe(jonas.id);
    expect(owners.every((c) => c.offers === "{}")).toBe(true);
  });

  it("Geschenk: Besitzwechsel und 30 Tage Sperre für Weitergabe", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const copy = await makeCopy(marc, "Heidi", { offers: "{gift}" });
    const loan = await svc.requestLoan(lea, { copyId: copy, kind: "gift" });
    await svc.accept(marc, loan.id, {});
    const t = await createToken(marc, loan.id);
    await redeemToken(lea, t.token);
    expect(await status(loan.id)).toBe("completed");
    const [c] = await sql<{ owner_id: string; locked: boolean }[]>`select owner_id, transfer_locked_until > now() as locked from copies where id = ${copy}`;
    expect(c.owner_id).toBe(lea.id);
    expect(c.locked).toBe(true);
  });
});

describe("Direkte Weitergabe", () => {
  it("ein Scan beendet die erste und startet die zweite Leihe", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea", { trust: 1 });
    const jonas = await makeUser("Jonas", { trust: 1 });
    const copy = await makeCopy(marc, "Der Zauberberg");
    const a = await svc.requestLoan(lea, { copyId: copy, kind: "lend", start: day(0), end: day(14) });
    await svc.accept(marc, a.id, {});
    const t = await createToken(marc, a.id);
    await redeemToken(lea, t.token);

    const b = await svc.requestLoan(jonas, { copyId: copy, kind: "lend", start: day(17), end: day(30) });
    await svc.accept(marc, b.id, {});
    const [chat] = await sql<{ n: number }[]>`select count(*)::int as n from handover_chats where next_loan_id = ${b.id}`;
    expect(chat.n).toBe(1);

    await passOnConsent(marc, b.id, true);
    await passOnConsent(lea, b.id, true);
    const res = await passOnConsent(jonas, b.id, true);
    expect(res.complete).toBe(true);

    // Falsche Person kann keinen Weitergabecode zeigen
    await expect(createToken(jonas, b.id)).rejects.toThrow();
    const pt = await createToken(lea, b.id);
    expect(pt.direction).toBe("pass_on");
    await redeemToken(jonas, pt.token);
    expect(await status(a.id)).toBe("returned");
    expect(await status(b.id)).toBe("active");
  });
});

describe("Fristen und Streitfall", () => {
  it("Fall frühestens nach 7 Tagen Verzug, Rückgabe schliesst ihn", async () => {
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const copy = await makeCopy(marc, "Faust");
    const l = await svc.requestLoan(lea, { copyId: copy, kind: "lend", start: day(0), end: day(14) });
    await svc.accept(marc, l.id, {});
    await redeemToken(lea, (await createToken(marc, l.id)).token);
    await expect(svc.openCase(marc, l.id)).rejects.toMatchObject({ code: "too_early" });
    await ageLoan(l.id, 24 * 22);
    const { caseId } = await svc.openCase(marc, l.id);
    expect(await status(l.id)).toBe("disputed");
    await svc.respondToCase(lea, caseId, { response: "return_date", returnAt: new Date(Date.now() + 86400_000).toISOString() });
    await redeemToken(marc, (await createToken(lea, l.id)).token);
    expect(await status(l.id)).toBe("returned");
    const [c] = await sql<{ outcome: string }[]>`select outcome from cases where id = ${caseId}`;
    expect(c.outcome).toBe("returned");
    const [late] = await sql<{ late: boolean }[]>`select late from loans where id = ${l.id}`;
    expect(late.late).toBe(true);
  });
});

describe("Fristenlauf", () => {
  it("verfällt Anfragen, schliesst Prüfungen ab und erinnert genau einmal", async () => {
    const { runDeadlines } = await import("@/worker/deadlines");
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const c1 = await makeCopy(marc, "Unterm Rad");
    const c2 = await makeCopy(marc, "Der Richter und sein Henker");
    const r1 = await svc.requestLoan(lea, { copyId: c1, kind: "lend" });
    await ageLoan(r1.id, 73);

    const r2 = await svc.requestLoan(lea, { copyId: c2, kind: "lend", start: day(0), end: day(6) });
    await svc.accept(marc, r2.id, {});
    await redeemToken(lea, (await createToken(marc, r2.id)).token);

    const out = await runDeadlines();
    expect(out.requests_expired).toBe(1);
    expect(await status(r1.id)).toBe("expired");

    // 5 Tage vor Fälligkeit: genau eine Erinnerung, auch bei mehreren Läufen
    await runDeadlines();
    const [n] = await sql<{ n: number }[]>`select count(*)::int as n from notifications where loan_id = ${r2.id} and type = 'due_soon' and channel = 'app'`;
    expect(n.n).toBe(1);

    await svc.reportReturn(lea, r2.id);
    await ageLoan(r2.id, 49);
    // Die Rückgabe gilt ab Meldung; die 48 h Prüfung laufen ab dann und sind ebenfalls vorbei
    await runDeadlines();
    expect(await status(r2.id)).toBe("completed");
    const actions = await sql<{ action: string }[]>`select action from loan_events where loan_id = ${r2.id} order by id`;
    expect(actions.map((a) => a.action).slice(-3)).toEqual(["report_return", "return_report_lapse", "complete"]);
  });
});

// ---------------------------------------------------------------------------
// Gemeinschaft: Pinnwand, geteilte Wünsche, Weg eines Buches, Zettel im Buch, Puls
// ---------------------------------------------------------------------------
describe("Gemeinschaft", () => {
  type U = Awaited<ReturnType<typeof makeUser>>;

  /** Kreis mit Admin und aktiven Mitgliedern */
  async function circleOf(admin: U, ...members: U[]) {
    const { createCircle } = await import("@/lib/circles");
    const id = await createCircle(admin.id, { name: "Lesekreis" });
    for (const m of members) await sql`insert into circle_members (circle_id, user_id) values (${id}, ${m.id})`;
    return id;
  }
  const shelve = (circleId: string, copyId: string) => sql`insert into circle_copies (circle_id, copy_id) values (${circleId}, ${copyId})`;
  const block = (a: U, b: U) => sql`insert into blocks (blocker_id, blocked_id) values (${a.id}, ${b.id})`;
  async function workOf(copyId: string) {
    const [w] = await sql<{ work_id: string }[]>`select e.work_id from copies c join editions e on e.id = c.edition_id where c.id = ${copyId}`;
    return w.work_id;
  }
  /** Zweites Exemplar desselben Werks bei einer anderen Person */
  async function copyOfWork(owner: U, workId: string, extra: Record<string, unknown> = {}) {
    const [e] = await sql<{ id: string }[]>`select id from editions where work_id = ${workId} limit 1`;
    const [c] = await sql<{ id: string }[]>`insert into copies ${sql({ owner_id: owner.id, edition_id: e.id, condition: 2, ...extra })} returning id`;
    return c.id;
  }
  /** Leihe von der Anfrage bis zum Abschluss über die echte Zustandsmaschine */
  async function lendFully(owner: U, borrower: U, copy: string) {
    const loan = await svc.requestLoan(borrower, { copyId: copy, kind: "lend" });
    if ((await status(loan.id)) === "requested") await svc.accept(owner, loan.id, {});
    await redeemToken(borrower, (await createToken(owner, loan.id)).token);
    await redeemToken(owner, (await createToken(borrower, loan.id)).token);
    await svc.complete(owner, loan.id);
    // Zeit vergeht: der Kalender ist für die nächste Leihe wieder frei
    await sql`delete from copy_bookings where loan_id = ${loan.id}`;
    return loan.id;
  }
  const appNotes = (u: U, type: string) =>
    sql<{ payload: { href?: string; text?: string; name?: string } }[]>`select payload from notifications where user_id = ${u.id} and type = ${type} and channel = 'app' order by created_at`;

  it("Pinnwand: nur Mitglieder, Ankündigung nur Admins, Empfehlung nur mit eigenem Exemplar im Kreisregal", async () => {
    const pin = await import("@/lib/pinboard");
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const fremd = await makeUser("Fremd");
    const circle = await circleOf(marc, lea);
    const inShelf = await makeCopy(lea, "Stiller");
    const notInShelf = await makeCopy(lea, "Homo faber");
    const marcs = await makeCopy(marc, "Die Wand");
    await shelve(circle, inShelf);
    await shelve(circle, marcs);

    // Nicht-Mitglied: weder lesen noch schreiben, und erfährt nicht, ob es den Kreis gibt
    await expect(pin.listPosts(circle, fremd.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(pin.createPost(fremd.id, circle, { kind: "search", workId: await workOf(marcs) })).rejects.toMatchObject({ code: "not_found" });
    // … auch nicht an der Anwendung vorbei
    await expect(sql`insert into circle_posts (circle_id, author_id, kind, work_id) values (${circle}, ${fremd.id}, 'search', ${await workOf(marcs)})`).rejects.toMatchObject({ code: "23514" });

    // Ankündigung: nur Admins (Anwendung und Datenbank)
    await expect(pin.createPost(lea.id, circle, { kind: "announce", text: "Tauschabend" })).rejects.toMatchObject({ code: "forbidden" });
    await expect(sql`insert into circle_posts (circle_id, author_id, kind, body) values (${circle}, ${lea.id}, 'announce', 'Tauschabend')`).rejects.toMatchObject({ code: "23514" });
    const eventAt = new Date(Date.now() + 14 * 86400_000).toISOString();
    const announce = await pin.createPost(marc.id, circle, { kind: "announce", text: "Tauschabend am 4. Dezember", eventAt, eventPlace: "Bibliothek; Saal 2" });

    // Empfehlung: eigenes Exemplar, das im Regal genau dieses Kreises steht
    await expect(pin.createPost(lea.id, circle, { kind: "recommend", copyId: notInShelf, text: "Lesen!" })).rejects.toMatchObject({ code: "invalid" });
    await expect(pin.createPost(lea.id, circle, { kind: "recommend", copyId: marcs, text: "Lesen!" })).rejects.toMatchObject({ code: "invalid" });
    await expect(pin.createPost(lea.id, circle, { kind: "recommend", copyId: inShelf, text: " " })).rejects.toMatchObject({ code: "invalid" });
    const rec = await pin.createPost(lea.id, circle, { kind: "recommend", copyId: inShelf, text: "Hat mich nicht mehr losgelassen." });

    // Längen: Anwendung und Datenbank
    await expect(pin.createPost(lea.id, circle, { kind: "search", workId: await workOf(marcs), text: "x".repeat(281) })).rejects.toMatchObject({ code: "invalid" });
    await expect(sql`insert into circle_posts (circle_id, author_id, kind, work_id, body) values (${circle}, ${lea.id}, 'search', ${await workOf(marcs)}, ${"x".repeat(281)})`).rejects.toMatchObject({ code: "23514" });
    await expect(pin.addComment(marc.id, rec, "x".repeat(501))).rejects.toMatchObject({ code: "invalid" });
    await expect(sql`insert into circle_post_comments (post_id, author_id, body) values (${rec}, ${marc.id}, ${"x".repeat(501)})`).rejects.toMatchObject({ code: "23514" });

    const page = await pin.listPosts(circle, lea.id);
    expect(page.role).toBe("member");
    expect(page.posts.map((p) => p.id)).toEqual([rec, announce]);
    const [r, a] = page.posts;
    expect(r.copy).toMatchObject({ id: inShelf, title: "Stiller", status: "available", lent_until: null });
    expect(r.work?.title).toBe("Stiller");
    expect(r.canDelete).toBe(true);
    expect(a).toMatchObject({ kind: "announce", canDelete: false, event_place: "Bibliothek; Saal 2", ics: `/circles/${circle}/posts/${announce}/ics` });
    expect(a.author).toEqual({ id: marc.id, first_name: "Marc", avatar_key: null });

    // Kalenderdatei: nur Mitglieder, Ort maskiert
    const ics = await pin.announcementIcs(lea.id, announce);
    expect(ics).toContain(String.raw`LOCATION:Bibliothek\; Saal 2`);
    expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/);
    await expect(pin.announcementIcs(fremd.id, announce)).rejects.toMatchObject({ code: "not_found" });

    // Verfügbarkeit der Empfehlung ist live
    const loan = await svc.requestLoan(marc, { copyId: inShelf, kind: "lend" });
    await svc.accept(lea, loan.id, {});
    await redeemToken(marc, (await createToken(lea, loan.id)).token);
    const live = await pin.getPost(circle, marc.id, rec);
    expect(live?.copy?.status).toBe("lent");
    expect(live?.copy?.lent_until).toBeInstanceOf(Date);

    // Löschen: eigene Zettel und Kommentare; Admins alles; andere nichts
    const c1 = await pin.addComment(marc.id, rec, "Danke für den Tipp");
    await expect(pin.deleteComment(fremd.id, c1)).rejects.toMatchObject({ code: "not_found" });
    await expect(pin.deletePost(lea.id, announce)).rejects.toMatchObject({ code: "forbidden" });
    const c2 = await pin.addComment(lea.id, announce, "Ich komme");
    await pin.deleteComment(marc.id, c2); // Admin entfernt fremden Kommentar
    await pin.deleteComment(marc.id, c1); // eigener
    await pin.deletePost(marc.id, rec);   // Admin entfernt fremden Zettel
    expect((await pin.listPosts(circle, lea.id)).posts.map((p) => p.id)).toEqual([announce]);
  });

  it("Pinnwand: Preisangaben werden markiert, Gesperrte schreiben nicht, Blockierte sehen einander nicht", async () => {
    const pin = await import("@/lib/pinboard");
    const mod = await import("@/lib/moderation");
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const jonas = await makeUser("Jonas");
    const circle = await circleOf(marc, lea, jonas);
    const copy = await makeCopy(marc, "Momo");
    await shelve(circle, copy);
    const work = await workOf(copy);

    // Preisfilter: Zettel und Kommentar werden markiert und automatisch gemeldet
    const priced = await pin.createPost(marc.id, circle, { kind: "announce", text: "Verkaufe Bücher, 5 CHF das Stück" });
    const comment = await pin.addComment(lea.id, priced, "Zahle per Twint");
    const reports = await sql<{ target_type: string; target_id: string; reason: string; reporter_id: string | null }[]>`select target_type, target_id, reason, reporter_id from reports order by created_at`;
    expect(reports).toEqual([
      { target_type: "circle_post", target_id: priced, reason: "price_pattern", reporter_id: null },
      { target_type: "circle_post_comment", target_id: comment, reason: "price_pattern", reporter_id: null },
    ]);
    // Moderation: die Meldung trägt den Text, Ausblenden nimmt den Zettel aus der Ansicht
    const q = await mod.queue();
    expect(q.reports.map((r) => r.context?.text)).toEqual(["Verkaufe Bücher, 5 CHF das Stück", "Zahle per Twint"]);
    expect(q.reports[0].context).toMatchObject({ author: "Marc", where: "Lesekreis", hidden: false });
    const moderator = { ...(await makeUser("Mod")), role: "moderator" as const };
    await mod.hideContent(moderator, "circle_post", priced, true);
    expect((await pin.listPosts(circle, lea.id)).posts).toHaveLength(0);
    await expect(pin.addComment(lea.id, priced, "noch da?")).rejects.toMatchObject({ code: "not_found" });

    // Gesperrtes Konto: schreibt nichts mehr
    const search = await pin.createPost(lea.id, circle, { kind: "search", workId: work, text: "Für die Ferien" });
    await sql`update users set banned_at = now() where id = ${jonas.id}`;
    await expect(pin.createPost(jonas.id, circle, { kind: "search", workId: work })).rejects.toMatchObject({ code: "forbidden" });
    await expect(pin.addComment(jonas.id, search, "Hallo")).rejects.toMatchObject({ code: "forbidden" });
    await expect(pin.react(jonas.id, search, "thanks")).rejects.toMatchObject({ code: "forbidden" });
    await sql`update users set banned_at = null where id = ${jonas.id}`;

    // Blockierung: Lea blockiert Jonas – beide sehen die Zettel und Kommentare der anderen Person nicht
    const jonasCopy = await copyOfWork(jonas, work);
    const jonasComment = await pin.addComment(jonas.id, search, "Ich hab es gelesen");
    const jonasPost = await pin.createPost(jonas.id, circle, { kind: "search", workId: (await workOf(await makeCopy(marc, "Faust"))) });
    await block(lea, jonas);
    const forLea = await pin.listPosts(circle, lea.id);
    expect(forLea.posts.map((p) => p.id)).toEqual([search]);
    expect(forLea.posts[0].comments.map((c) => c.id)).not.toContain(jonasComment);
    expect((await pin.listPosts(circle, jonas.id)).posts.map((p) => p.id)).toEqual([jonasPost]);
    expect((await pin.listPosts(circle, marc.id)).posts.map((p) => p.id)).toEqual([jonasPost, search]);
    await expect(pin.addComment(jonas.id, search, "Hallo?")).rejects.toMatchObject({ code: "not_found" });
    await expect(pin.react(jonas.id, search, "want")).rejects.toMatchObject({ code: "not_found" });
    await expect(pin.offerCopy(jonas.id, search, jonasCopy)).rejects.toMatchObject({ code: "not_found" });
    await expect(pin.getPost(circle, jonas.id, search)).resolves.toBeNull();

    // Wer den Kreis verlässt, nimmt seine Zettel mit
    const { setMember } = await import("@/lib/circles");
    await setMember(marc.id, circle, jonas.id, "remove");
    expect((await pin.listPosts(circle, marc.id)).posts.map((p) => p.id)).toEqual([search]);
    const [left] = await sql<{ n: number }[]>`select count(*)::int as n from circle_posts where author_id = ${jonas.id}`;
    expect(left.n).toBe(0);
  });

  it("Reaktionen: zwei Arten, umschaltbar; «Will ich auch lesen» legt auf Wunsch einen Wunsch an", async () => {
    const pin = await import("@/lib/pinboard");
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const circle = await circleOf(marc, lea);
    const copy = await makeCopy(marc, "Der Steppenwolf");
    await shelve(circle, copy);
    const post = await pin.createPost(marc.id, circle, { kind: "recommend", copyId: copy, text: "Immer wieder." });

    const once = await pin.react(lea.id, post, "thanks");
    const twice = await pin.react(lea.id, post, "thanks");
    expect(once.reactions).toEqual({ thanks: 1, want: 0, mine: { thanks: true, want: false } });
    expect(twice.reactions).toEqual(once.reactions);
    expect(await appNotes(marc, "circle_post_reply")).toHaveLength(1); // nicht bei jedem Antippen erneut
    await expect(sql`insert into circle_post_reactions (post_id, user_id, kind) values (${post}, ${lea.id}, 'love')`).rejects.toMatchObject({ code: "23514" });

    // «Will ich auch lesen» ohne und mit Wunschliste
    expect((await pin.react(lea.id, post, "want")).wishlisted).toBe(false);
    const [none] = await sql<{ n: number }[]>`select count(*)::int as n from wishlist_items where user_id = ${lea.id}`;
    expect(none.n).toBe(0);
    await pin.unreact(lea.id, post, "want");
    const want = await pin.react(lea.id, post, "want", { addToWishlist: true });
    expect(want).toMatchObject({ wishlisted: true, reactions: { thanks: 1, want: 1, mine: { thanks: true, want: true } } });
    // Ein bestehender Wunsch bleibt, wie er ist
    await sql`update wishlist_items set radius_km = 20 where user_id = ${lea.id}`;
    await pin.unreact(lea.id, post, "want");
    await pin.react(lea.id, post, "want", { addToWishlist: true });
    const wishes = await sql<{ work_id: string; radius_km: number }[]>`select work_id, radius_km from wishlist_items where user_id = ${lea.id}`;
    expect(wishes).toEqual([{ work_id: await workOf(copy), radius_km: 20 }]);

    const off = await pin.unreact(lea.id, post, "thanks");
    expect(off.reactions).toEqual({ thanks: 0, want: 1, mine: { thanks: false, want: true } });
    const seen = await pin.getPost(circle, marc.id, post);
    expect(seen?.reactions).toEqual({ thanks: 0, want: 1, mine: { thanks: false, want: false } });
  });

  it("«Ich hab's»: Angebot, Benachrichtigung, normale Anfrage – die Übergabe erfüllt die Suche", async () => {
    const pin = await import("@/lib/pinboard");
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const jonas = await makeUser("Jonas");
    const circle = await circleOf(marc, lea, jonas);
    const copy = await makeCopy(marc, "Die Schwarze Spinne", { visibility: "circles" });
    const other = await makeCopy(marc, "Uli der Knecht");
    await shelve(circle, copy);
    const work = await workOf(copy);

    const post = await pin.createPost(lea.id, circle, { kind: "search", workId: work, neededBy: day(30) });
    await expect(pin.createPost(lea.id, circle, { kind: "search", workId: work })).rejects.toMatchObject({ code: "duplicate_search" });
    await expect(pin.createPost(lea.id, circle, { kind: "search", workId: await workOf(other), neededBy: day(-1) })).rejects.toMatchObject({ code: "invalid" });

    // Marc sieht, dass er ein passendes Exemplar hat; Jonas nicht; Lea selbst bekommt keinen Knopf
    const forMarc = (await pin.listPosts(circle, marc.id)).posts[0];
    expect(forMarc).toMatchObject({ kind: "search", needed_by: day(30), offeredByMe: false, myMatchingCopies: [{ id: copy, title: "Die Schwarze Spinne", lendable: true }] });
    expect((await pin.listPosts(circle, jonas.id)).posts[0].myMatchingCopies).toEqual([]);
    expect((await pin.listPosts(circle, lea.id)).posts[0].myMatchingCopies).toEqual([]);

    // Nur eigene Exemplare genau dieses Werks, nicht auf den eigenen Zettel, nur auf Suchzettel
    await expect(pin.offerCopy(marc.id, post, other)).rejects.toMatchObject({ code: "invalid" });
    await expect(pin.offerCopy(jonas.id, post, copy)).rejects.toMatchObject({ code: "invalid" });
    await expect(pin.offerCopy(lea.id, post, copy)).rejects.toMatchObject({ code: "invalid" });
    // Nicht angebotene Exemplare lassen sich nicht anbieten
    await sql`update copies set offers = '{}' where id = ${copy}`;
    await expect(pin.offerCopy(marc.id, post, copy)).rejects.toMatchObject({ code: "not_offered" });
    await sql`update copies set offers = '{lend}' where id = ${copy}`;

    const offer = await pin.offerCopy(marc.id, post, copy);
    expect(offer).toEqual({ href: `/exemplar/${copy}?zettel=${post}`, created: true });
    expect((await pin.offerCopy(marc.id, post, copy)).created).toBe(false);
    const sent = await appNotes(lea, "circle_post_offer");
    expect(sent).toHaveLength(1);
    expect(sent[0].payload).toMatchObject({ name: "Marc", title: "Die Schwarze Spinne", href: `/exemplar/${copy}?zettel=${post}` });
    expect((await pin.listPosts(circle, marc.id)).posts[0].offeredByMe).toBe(true);
    expect((await pin.listPosts(circle, lea.id)).posts[0].offers).toBe(1);
    // Kein Sonderweg: das Angebot hat keinen Vorgang angelegt
    const [loans] = await sql<{ n: number }[]>`select count(*)::int as n from loans`;
    expect(loans.n).toBe(0);

    // Lea fragt ganz normal an; erst die Übergabe erfüllt die Suche
    const loan = await svc.requestLoan(lea, { copyId: copy, kind: "lend" });
    await svc.accept(marc, loan.id, {});
    expect((await pin.listPosts(circle, marc.id)).posts).toHaveLength(1);
    await redeemToken(lea, (await createToken(marc, loan.id)).token);
    expect(await status(loan.id)).toBe("active");
    const [done] = await sql<{ fulfilled_at: Date | null }[]>`select fulfilled_at from circle_posts where id = ${post}`;
    expect(done.fulfilled_at).toBeInstanceOf(Date);
    expect((await pin.listPosts(circle, marc.id)).posts).toHaveLength(0);
    await expect(pin.offerCopy(marc.id, post, copy)).rejects.toMatchObject({ code: "not_found" });

    // Von Hand erledigen (und zurücknehmen) kann nur die suchende Person
    const manual = await pin.createPost(lea.id, circle, { kind: "search", workId: await workOf(other) });
    await expect(pin.setFulfilled(marc.id, manual, true)).rejects.toMatchObject({ code: "not_found" });
    await pin.setFulfilled(lea.id, manual, true);
    expect((await pin.listPosts(circle, lea.id)).posts).toHaveLength(0);
    await pin.setFulfilled(lea.id, manual, false);
    expect((await pin.listPosts(circle, lea.id)).posts.map((p) => p.id)).toEqual([manual]);
    await expect(sql`update circle_posts set fulfilled_at = now() where kind <> 'search'`).resolves.toBeDefined();
  });

  it("Zettel verfallen nach 60 Tagen aus der Ansicht; die Liste blättert mit before", async () => {
    const pin = await import("@/lib/pinboard");
    const marc = await makeUser("Marc");
    const circle = await circleOf(marc);
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      ids.push(await pin.createPost(marc.id, circle, { kind: "announce", text: `Hinweis ${i}` }));
      await sql`update circle_posts set created_at = now() - make_interval(days => ${5 - i}) where id = ${ids[i]}`;
    }
    const first = await pin.listPosts(circle, marc.id, { limit: 2 });
    expect(first.posts.map((p) => p.text)).toEqual(["Hinweis 4", "Hinweis 3"]);
    expect(first.nextBefore).toBeTruthy();
    const second = await pin.listPosts(circle, marc.id, { limit: 2, before: first.nextBefore });
    expect(second.posts.map((p) => p.text)).toEqual(["Hinweis 2", "Hinweis 1"]);
    const third = await pin.listPosts(circle, marc.id, { limit: 2, before: second.nextBefore });
    expect(third.posts.map((p) => p.text)).toEqual(["Hinweis 0"]);
    expect(third.nextBefore).toBeNull();

    await sql`update circle_posts set created_at = now() - interval '61 days' where id = ${ids[4]}`;
    await sql`update circle_posts set created_at = now() - interval '59 days' where id = ${ids[3]}`;
    const left = (await pin.listPosts(circle, marc.id)).posts.map((p) => p.id);
    expect(left).not.toContain(ids[4]);
    expect(left).toContain(ids[3]);
    await expect(pin.addComment(marc.id, ids[4], "zu spät")).rejects.toMatchObject({ code: "not_found" });
    // Die Zeile bleibt (kein Löschen beim Verfall)
    const [row] = await sql<{ n: number }[]>`select count(*)::int as n from circle_posts where id = ${ids[4]}`;
    expect(row.n).toBe(1);
  });

  it("Live: jede Änderung an der Pinnwand wird auf dem Kanal «circle» gemeldet", async () => {
    const pin = await import("@/lib/pinboard");
    const { subscribe } = await import("@/lib/live");
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const circle = await circleOf(marc, lea);
    const seen: { circle_id: string; post_id: string; op: string }[] = [];
    const stop = await subscribe("circle", (p) => seen.push(JSON.parse(p)));
    const post = await pin.createPost(marc.id, circle, { kind: "announce", text: "Tauschabend" });
    await pin.react(lea.id, post, "thanks");
    const comment = await pin.addComment(lea.id, post, "Gern");
    await pin.deleteComment(lea.id, comment);
    await pin.deletePost(marc.id, post);
    await new Promise((r) => setTimeout(r, 200));
    stop();
    expect(seen.every((e) => e.circle_id === circle && e.post_id === post)).toBe(true);
    // Löschen des Zettels meldet einmal «delete», nicht jede mitgelöschte Reaktion einzeln
    expect(seen.map((e) => e.op)).toEqual(["insert", "reaction", "comment", "comment", "delete"]);
  });

  it("Benachrichtigungen zur Pinnwand folgen dem eigenen Schalter", async () => {
    const pin = await import("@/lib/pinboard");
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");     // Standard: nur Antworten
    const jonas = await makeUser("Jonas"); // alles
    const nina = await makeUser("Nina");   // nichts
    await sql`update users set pinboard_notify = 'all' where id = ${jonas.id}`;
    await sql`update users set pinboard_notify = 'off' where id = ${nina.id}`;
    const circle = await circleOf(marc, lea, jonas, nina);
    const channels = async (u: U, type: string) =>
      (await sql<{ channel: string }[]>`select channel from notifications where user_id = ${u.id} and type = ${type} order by channel`).map((r) => r.channel);

    await pin.createPost(marc.id, circle, { kind: "announce", text: "Tauschabend" });
    expect(await channels(jonas, "circle_post_new")).toEqual(["app", "email"]);
    expect(await channels(lea, "circle_post_new")).toEqual([]);
    expect(await channels(nina, "circle_post_new")).toEqual([]);

    const leas = await pin.createPost(lea.id, circle, { kind: "announce", text: "x" }).catch(() => null);
    expect(leas).toBeNull(); // Lea ist keine Admin
    await sql`update circle_members set role = 'admin' where circle_id = ${circle}`;
    const fromLea = await pin.createPost(lea.id, circle, { kind: "announce", text: "Leseabend" });
    const fromNina = await pin.createPost(nina.id, circle, { kind: "announce", text: "Flohmarkt" });
    await pin.addComment(marc.id, fromLea, "Bin dabei");
    await pin.addComment(marc.id, fromNina, "Bin dabei");
    await pin.addComment(lea.id, fromLea, "Schön"); // eigene Antwort: keine Benachrichtigung an sich selbst
    expect(await channels(lea, "circle_post_reply")).toEqual(["app", "email"]);
    expect(await channels(nina, "circle_post_reply")).toEqual(["app"]); // «off»: nur in der App
    const [n] = await appNotes(lea, "circle_post_reply");
    expect(n.payload).toMatchObject({ name: "Marc", text: "Bin dabei", href: `/kreise/${circle}#pinnwand` });

    const { renderNotification } = await import("@/lib/notify");
    expect(renderNotification("circle_post_reply", n.payload as never, "de").title).toBe("Marc zu deinem Zettel");
    expect(renderNotification("circle_post_offer", { name: "Marc", title: "Stiller" }, "fr").title).toBe("Marc a « Stiller »");
    expect(renderNotification("circle_post_new", { name: "Marc", circle: "Lesekreis" }, "it")).toEqual({ title: "Marc nella cerchia «Lesekreis»", body: "Nuovo biglietto in bacheca." });
  });

  it("Wünsche im Kreis: nur geteilt, nur unter Mitgliedern, nie bei Blockierung", async () => {
    const wl = await import("@/lib/wishlist");
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const jonas = await makeUser("Jonas");
    const fremd = await makeUser("Fremd");
    const circle = await circleOf(marc, lea, jonas);
    const copy = await makeCopy(marc, "Heidi");
    await shelve(circle, copy);
    const work = await workOf(copy);

    await wl.addWish(lea.id, lea.plan_id, work, 5, true);
    await wl.addWish(jonas.id, jonas.plan_id, work);        // nicht geteilt
    await wl.addWish(fremd.id, fremd.plan_id, work, 5, true); // geteilt, aber in keinem gemeinsamen Kreis
    expect((await wl.listWishlist(lea.id))[0].share_circles).toBe(true);
    expect((await wl.listWishlist(jonas.id))[0].share_circles).toBe(false);

    // A: auf dem eigenen Exemplar
    expect(await wl.wishersInMyCircles(marc.id, copy)).toEqual({ count: 1, people: [{ id: lea.id, first_name: "Lea", circle_name: "Lesekreis" }] });
    expect(await wl.wishersCount(marc.id, copy)).toBe(1);
    await expect(wl.wishersInMyCircles(lea.id, copy)).rejects.toMatchObject({ code: "not_found" });

    // B: auf der Wunschliste – das Exemplar im Kreisregal, frei oder frei ab
    expect(await wl.circleHitsForWishlist(lea.id)).toEqual([
      { work_id: work, circle_id: circle, circle_name: "Lesekreis", copy_id: copy, owner_name: "Marc", free_now: true, free_from: null },
    ]);
    expect(await wl.circleHitsForWishlist(fremd.id)).toEqual([]);
    expect(await wl.circleHitsForWishlist(marc.id)).toEqual([]);
    const booked = await svc.requestLoan(jonas, { copyId: copy, kind: "lend", start: day(0), end: day(14) });
    await svc.accept(marc, booked.id, {});
    expect((await wl.circleHitsForWishlist(lea.id))[0]).toMatchObject({ free_now: false, free_from: day(17) }); // 14 Tage plus 3 Tage Puffer

    // C: Brett «Gesucht im Kreis» – Zahl ohne Namen, mit eigenem Exemplar
    const board = await wl.wantedInCircle(circle, marc.id);
    expect(board).toEqual([{ work_id: work, title: "Heidi", authors: ["Autorin"], cover_key: null, cover_w: null, cover_h: null, count: 1, my_copy_id: copy }]);
    expect(JSON.stringify(board)).not.toContain(lea.id);
    expect((await wl.wantedInCircle(circle, jonas.id))[0]).toMatchObject({ count: 1, my_copy_id: null });
    expect(await wl.wantedInCircle(circle, lea.id)).toEqual([]); // der eigene Wunsch zählt nicht
    await expect(wl.wantedInCircle(circle, fremd.id)).rejects.toMatchObject({ code: "not_found" });

    // Schalter aus: überall weg. Jonas schaltet ein: zählt mit.
    await wl.updateWish(lea.id, work, { shareCircles: false });
    expect((await wl.wishersInMyCircles(marc.id, copy)).count).toBe(0);
    expect(await wl.wantedInCircle(circle, marc.id)).toEqual([]);
    await wl.updateWish(lea.id, work, { shareCircles: true });
    await wl.updateWish(jonas.id, work, { shareCircles: true });
    expect((await wl.wishersInMyCircles(marc.id, copy)).people.map((p) => p.first_name)).toEqual(["Jonas", "Lea"]);
    // Blockierung in beide Richtungen
    await block(lea, marc);
    expect((await wl.wishersInMyCircles(marc.id, copy)).people.map((p) => p.first_name)).toEqual(["Jonas"]);
    expect((await wl.wantedInCircle(circle, marc.id))[0].count).toBe(1);
    expect(await wl.circleHitsForWishlist(lea.id)).toEqual([]);
    // Wer nur anfragt (pending), zählt nicht als Mitglied
    await sql`update circle_members set status = 'pending' where circle_id = ${circle} and user_id = ${jonas.id}`;
    expect((await wl.wishersInMyCircles(marc.id, copy)).count).toBe(0);
  });

  it("Weg eines Buches: erst ab zwei Übergaben, anonym mit Gemeinde und Monat", async () => {
    const { bookPath } = await import("@/lib/book-path");
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const jonas = await makeUser("Jonas");
    await sql`update users set municipality = 'Kloten' where id = ${lea.id}`;
    await sql`update users set municipality = 'Embrach' where id = ${jonas.id}`;
    const copy = await makeCopy(marc, "Der grüne Heinrich");

    expect(await bookPath(copy)).toBeNull();
    const first = await lendFully(marc, lea, copy);
    expect(await bookPath(copy)).toBeNull(); // eine Leihe: zu wenig, um niemanden erkennbar zu machen
    // Eine laufende, nicht abgeschlossene Leihe zählt nicht
    const open = await svc.requestLoan(jonas, { copyId: copy, kind: "lend" });
    await svc.accept(marc, open.id, {});
    await redeemToken(jonas, (await createToken(marc, open.id)).token);
    expect(await bookPath(copy)).toBeNull();
    await redeemToken(marc, (await createToken(jonas, open.id)).token);
    await svc.complete(marc, open.id);
    await sql`update loans set handed_over_at = handed_over_at - interval '70 days' where id = ${first}`;

    const path = await bookPath(copy);
    const month = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit" }).format(d);
    expect(path).toEqual({
      hands: 3,
      municipalities: 3,
      since: month(new Date(Date.now() - 70 * 86400_000)),
      stations: [
        { municipality: "Kloten", month: month(new Date(Date.now() - 70 * 86400_000)) },
        { municipality: "Embrach", month: month(new Date()) },
      ],
    });
    // Anonym: keine Namen, keine Ids, keine genauen Daten, keine PLZ
    const json = JSON.stringify(path);
    for (const secret of [marc.id, lea.id, jonas.id, "Marc", "Lea", "Jonas", "8180", first]) expect(json).not.toContain(secret);
    expect(json).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("Zettel im Buch: nur die leihende Person, nur nach Abschluss, einmal; die Besitzerin blendet aus", async () => {
    const notes = await import("@/lib/book-path");
    const { loanView } = await import("@/lib/loans/queries");
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const jonas = await makeUser("Jonas");
    const copy = await makeCopy(marc, "Das Parfum");

    const loan = await svc.requestLoan(lea, { copyId: copy, kind: "lend" });
    await svc.accept(marc, loan.id, {});
    await redeemToken(lea, (await createToken(marc, loan.id)).token);
    // Während der Leihe: noch nicht – auch nicht an der Anwendung vorbei
    await expect(notes.leaveNote(lea.id, loan.id, { body: "Zu früh" })).rejects.toMatchObject({ code: "note_closed" });
    await expect(sql`insert into book_notes (copy_id, loan_id, author_id, body) values (${copy}, ${loan.id}, ${lea.id}, 'Zu früh')`).rejects.toMatchObject({ code: "23514" });
    expect((await loanView(loan.id, lea.id)).canLeaveNote).toBe(false);
    await redeemToken(marc, (await createToken(lea, loan.id)).token);
    await svc.complete(marc, loan.id);
    await sql`delete from copy_bookings where loan_id = ${loan.id}`;

    expect(await loanView(loan.id, lea.id)).toMatchObject({ canLeaveNote: true, bookNote: null });
    expect((await loanView(loan.id, marc.id)).canLeaveNote).toBe(false);
    await expect(notes.leaveNote(marc.id, loan.id, { body: "Mein eigenes Buch" })).rejects.toMatchObject({ code: "forbidden" });
    await expect(notes.leaveNote(jonas.id, loan.id, { body: "Fremd" })).rejects.toMatchObject({ code: "not_found" });
    await expect(sql`insert into book_notes (copy_id, loan_id, author_id, body) values (${copy}, ${loan.id}, ${marc.id}, 'Besitzer')`).rejects.toMatchObject({ code: "23514" });
    await expect(notes.leaveNote(lea.id, loan.id, { body: "x".repeat(201) })).rejects.toMatchObject({ code: "invalid" });
    await sql`update users set banned_at = now() where id = ${lea.id}`;
    await expect(notes.leaveNote(lea.id, loan.id, { body: "Gesperrt" })).rejects.toMatchObject({ code: "forbidden" });
    await sql`update users set banned_at = null where id = ${lea.id}`;

    const id = await notes.leaveNote(lea.id, loan.id, { body: " Lies es im Winter. " });
    await expect(notes.leaveNote(lea.id, loan.id, { body: "Noch einer" })).rejects.toMatchObject({ code: "already_noted" });
    await expect(sql`insert into book_notes (copy_id, loan_id, author_id, body) values (${copy}, ${loan.id}, ${lea.id}, 'Noch einer')`).rejects.toMatchObject({ code: "23505" });
    expect(await loanView(loan.id, lea.id)).toMatchObject({ canLeaveNote: false, bookNote: { id, body: "Lies es im Winter.", anonymous: false } });

    // Öffentlich wie die Exemplarseite: Text, Vorname, Monat
    const pub = await notes.notesForCopy(copy, null);
    expect(pub).toEqual([{ id, body: "Lies es im Winter.", first_name: "Lea", month: expect.stringMatching(/^\d{4}-\d{2}$/), hidden: false, mine: false }]);
    expect((await notes.notesForCopy(copy, lea.id))[0].mine).toBe(true);

    // Zweite Leihe: anonym, mit Preisangabe (wird markiert und gemeldet)
    const second = await lendFully(marc, jonas, copy);
    const anon = await notes.leaveNote(jonas.id, second, { body: "Gebraucht für 5 Fr. zu haben", anonymous: true });
    const [rep] = await sql<{ target_id: string; reason: string }[]>`select target_id, reason from reports where target_type = 'book_note'`;
    expect(rep).toEqual({ target_id: anon, reason: "price_pattern" });
    expect((await notes.notesForCopy(copy, null)).map((n) => n.first_name)).toEqual(["Lea", null]);

    // Ausblenden: nur die Besitzerin; öffentlich weg, für sie selbst markiert
    await expect(notes.setNoteHidden(lea.id, anon, true)).rejects.toMatchObject({ code: "not_found" });
    await notes.setNoteHidden(marc.id, anon, true);
    expect((await notes.notesForCopy(copy, null)).map((n) => n.id)).toEqual([id]);
    expect((await notes.notesForCopy(copy, jonas.id)).map((n) => n.id)).toEqual([id]);
    expect((await notes.notesForCopy(copy, marc.id)).map((n) => [n.id, n.hidden])).toEqual([[id, false], [anon, true]]);
    await notes.setNoteHidden(marc.id, anon, false);
    expect(await notes.notesForCopy(copy, null)).toHaveLength(2);
    // Was die Moderation ausblendet, holt die Besitzerin nicht zurück
    const mod = await import("@/lib/moderation");
    await mod.hideContent({ ...(await makeUser("Mod")), role: "moderator" as const }, "book_note", anon, true);
    await expect(notes.setNoteHidden(marc.id, anon, false)).rejects.toMatchObject({ code: "forbidden" });

    // Nach Ablauf der Bewertungsfrist ist auch der Zettel nicht mehr möglich
    const third = await lendFully(marc, lea, copy);
    await sql`update loans set rating_closes_at = now() - interval '1 minute' where id = ${third}`;
    await expect(notes.leaveNote(lea.id, third, { body: "Zu spät" })).rejects.toMatchObject({ code: "note_closed" });
    // Unsichtbares Exemplar: keine Zettel
    await sql`update copies set visibility = 'circles' where id = ${copy}`;
    await expect(notes.notesForCopy(copy, null)).rejects.toMatchObject({ code: "not_found" });
  });

  it("Puls: nur Zahlen und selbst Veröffentlichtes, mit Schalter und ohne Blockierte", async () => {
    const pin = await import("@/lib/pinboard");
    const { pulse } = await import("@/lib/pulse");
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const jonas = await makeUser("Jonas");
    const fremd = await makeUser("Fremd");
    const circle = await circleOf(marc, lea, jonas);
    expect(await pulse(marc.id)).toEqual([]);
    expect(await pulse(fremd.id)).toEqual([]);
    await expect(pulse(fremd.id, { circleId: circle })).rejects.toMatchObject({ code: "not_found" });

    const l1 = await makeCopy(lea, "Effi Briest");
    const l2 = await makeCopy(lea, "Irrungen, Wirrungen");
    const old = await makeCopy(lea, "Der Stechlin", { created_at: new Date(Date.now() - 30 * 86400_000) });
    const j1 = await makeCopy(jonas, "Buddenbrooks");
    const m1 = await makeCopy(marc, "Tonio Kröger");
    for (const c of [l1, l2, old, j1, m1]) await shelve(circle, c);
    await sql`update users set pulse_show_new_books = false where id = ${jonas.id}`;

    // Eine Übergabe im Kreis und eine ausserhalb (zählt nicht)
    const inCircle = await svc.requestLoan(jonas, { copyId: l1, kind: "lend" });
    await svc.accept(lea, inCircle.id, {});
    await redeemToken(jonas, (await createToken(lea, inCircle.id)).token);
    const outside = await makeCopy(fremd, "Anderswo");
    const o = await svc.requestLoan(marc, { copyId: outside, kind: "lend" });
    await svc.accept(fremd, o.id, {});
    await redeemToken(marc, (await createToken(fremd, o.id)).token);

    const post = await pin.createPost(lea.id, circle, { kind: "recommend", copyId: l2, text: "x".repeat(200) });
    await pin.createPost(marc.id, circle, { kind: "announce", text: "Eigener Zettel" });

    const items = await pulse(marc.id);
    expect(items).toEqual([
      { type: "moved", count: 1 },
      { type: "shelved", user: { id: lea.id, first_name: "Lea", avatar_key: null }, count: 2, circle: { id: circle, name: "Lesekreis" } },
      { type: "post", post: { id: post, kind: "recommend", text: "x".repeat(120), first_name: "Lea", circle: { id: circle, name: "Lesekreis" }, title: "Irrungen, Wirrungen", created_at: expect.any(Date) } },
    ]);
    expect(await pulse(marc.id, { circleId: circle })).toEqual(items);
    // Nie, wer von wem geliehen hat
    expect(JSON.stringify(items)).not.toContain("Jonas");
    expect(JSON.stringify(items)).not.toContain("Effi Briest");
    // Jonas schaltet sich wieder ein
    await sql`update users set pulse_show_new_books = true where id = ${jonas.id}`;
    expect((await pulse(marc.id)).filter((i) => i.type === "shelved").map((i) => i.type === "shelved" && i.user.first_name)).toEqual(["Lea", "Jonas"]);
    // Blockierte tauchen nicht auf, die Zahl bleibt
    await block(marc, lea);
    const after = await pulse(marc.id);
    expect(after.map((i) => i.type)).toEqual(["moved", "shelved"]);
    expect(JSON.stringify(after)).not.toContain("Lea");
  });

  it("Datenexport und Kontolöschung: Pinnwand verschwindet, Zettel im Buch bleiben anonym", async () => {
    const pin = await import("@/lib/pinboard");
    const notes = await import("@/lib/book-path");
    const { exportData, deleteAccount, updateSettings } = await import("@/lib/account");
    const marc = await makeUser("Marc");
    const lea = await makeUser("Lea");
    const circle = await circleOf(marc, lea);
    const copy = await makeCopy(marc, "Der Besuch der alten Dame");
    const leas = await makeCopy(lea, "Die Physiker");
    await shelve(circle, copy);
    await shelve(circle, leas);

    const search = await pin.createPost(marc.id, circle, { kind: "search", workId: await workOf(leas) });
    const rec = await pin.createPost(lea.id, circle, { kind: "recommend", copyId: leas, text: "Kurz und böse." });
    const marcsPost = await pin.createPost(marc.id, circle, { kind: "announce", text: "Leseabend" });
    await pin.addComment(lea.id, marcsPost, "Ich bringe Kuchen");
    await pin.react(lea.id, marcsPost, "thanks");
    await pin.offerCopy(lea.id, search, leas);
    const loan = await lendFully(marc, lea, copy);
    const note = await notes.leaveNote(lea.id, loan, { body: "Ein Abend reicht." });
    await updateSettings(lea.id, { pulseShowNewBooks: false, pinboardNotify: "all" });

    const data = await exportData(lea.id);
    expect(data.user).toMatchObject({ pulse_show_new_books: false, pinboard_notify: "all" });
    expect(data.circlePosts.map((p) => p.id)).toEqual([rec]);
    expect(data.circlePostComments.map((c) => c.body)).toEqual(["Ich bringe Kuchen"]);
    expect(data.circlePostReactions).toHaveLength(1);
    expect(data.circlePostOffers).toHaveLength(1);
    expect(data.bookNotes.map((n) => n.body)).toEqual(["Ein Abend reicht."]);
    expect((await exportData(marc.id)).circlePosts).toHaveLength(2);

    await deleteAccount(lea.id);
    const [left] = await sql<{ posts: number; comments: number; reactions: number; offers: number }[]>`
      select (select count(*)::int from circle_posts where author_id = ${lea.id}) as posts,
             (select count(*)::int from circle_post_comments where author_id = ${lea.id}) as comments,
             (select count(*)::int from circle_post_reactions where user_id = ${lea.id}) as reactions,
             (select count(*)::int from circle_post_offers where user_id = ${lea.id}) as offers`;
    expect(left).toEqual({ posts: 0, comments: 0, reactions: 0, offers: 0 });
    const page = await pin.listPosts(circle, marc.id);
    expect(page.posts.map((p) => p.id)).toEqual([marcsPost, search]);
    expect(page.posts[0]).toMatchObject({ comments: [], comment_count: 0, reactions: { thanks: 0, want: 0 } });
    // Der Zettel im Buch bleibt beim Buch, ohne Bezug zur Person
    const [kept] = await sql<{ author_id: string | null; anonymous: boolean }[]>`select author_id, anonymous from book_notes where id = ${note}`;
    expect(kept).toEqual({ author_id: null, anonymous: true });
    expect(await notes.notesForCopy(copy, null)).toMatchObject([{ id: note, body: "Ein Abend reicht.", first_name: null }]);
    const [reset] = await sql<{ pulse_show_new_books: boolean; pinboard_notify: string }[]>`select pulse_show_new_books, pinboard_notify from users where id = ${lea.id}`;
    expect(reset).toEqual({ pulse_show_new_books: true, pinboard_notify: "replies" });
  });
});
