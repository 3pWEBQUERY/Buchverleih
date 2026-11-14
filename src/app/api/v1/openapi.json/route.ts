import { env } from "@/lib/env";
import { ACTIONS, LOAN_STATUSES } from "@/lib/loans/machine";

/**
 * GET /api/v1/openapi.json – OpenAPI-Beschreibung der einzigen Schreibschnittstelle.
 * Die Web-Oberfläche nutzt dieselbe API, die später die iOS-App nutzt (PRD 10.2).
 */
type Op = { method: "get" | "post" | "patch" | "put" | "delete"; path: string; tag: string; summary: string; body?: Record<string, unknown>; auth?: boolean };

const S = (props: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties: props, required });
const str = { type: "string" };
const uuid = { type: "string", format: "uuid" };
const day = { type: "string", format: "date" };
const bool = { type: "boolean" };
const int = { type: "integer" };
const dateTime = { type: "string", format: "date-time" };
const nullable = (s: Record<string, unknown>) => ({ anyOf: [s, { type: "null" }] });
const list = (items: unknown) => ({ type: "array", items });
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

/** Zettel anheften: je nach kind andere Felder */
const PostInput = {
  oneOf: [
    S({ kind: { const: "search" }, workId: uuid, neededBy: day, text: { type: "string", maxLength: 280 } }, ["kind", "workId"]),
    S({ kind: { const: "recommend" }, copyId: uuid, text: { type: "string", minLength: 1, maxLength: 280 } }, ["kind", "copyId", "text"]),
    S({ kind: { const: "announce" }, text: { type: "string", minLength: 1, maxLength: 500 }, eventAt: dateTime, eventPlace: { type: "string", maxLength: 120 } }, ["kind", "text"]),
  ],
};

/** Antwortformen der Gemeinschaft (Pinnwand, Weg eines Buches, Puls) */
const PinAuthor = S({ id: uuid, first_name: str, avatar_key: nullable(str) }, ["id", "first_name"]);
const schemas = {
  PinAuthor,
  PinReactions: S({ thanks: int, want: int, mine: S({ thanks: bool, want: bool }) }, ["thanks", "want", "mine"]),
  PinComment: S({ id: uuid, author: ref("PinAuthor"), body: str, created_at: dateTime, canDelete: bool }),
  PinWork: S({ id: uuid, title: str, authors: list(str), cover_key: nullable(str) }),
  PinCopy: S({
    id: uuid, work_id: uuid, title: str, authors: list(str), cover_key: nullable(str), photo_key: nullable(str), photo_w: nullable(int), photo_h: nullable(int),
    owner_id: uuid, status: { enum: ["lent", "reserved", "requested", "available", "not_offered", "paused"] }, lent_until: nullable(dateTime),
  }),
  PinPost: S({
    id: uuid, circle_id: uuid, kind: { enum: ["search", "recommend", "announce"] }, author: ref("PinAuthor"), mine: bool, text: nullable(str), created_at: dateTime,
    work: nullable(ref("PinWork")), copy: nullable(ref("PinCopy")), needed_by: nullable(day), fulfilled_at: nullable(dateTime),
    event_at: nullable(dateTime), event_place: nullable(str), ics: nullable(str), reactions: ref("PinReactions"),
    comments: list(ref("PinComment")), comment_count: int, canDelete: bool,
    myMatchingCopies: list(S({ id: uuid, title: str, lendable: bool })), offeredByMe: bool, offers: int,
  }),
  PinboardPage: S({ posts: list(ref("PinPost")), nextBefore: nullable(str), role: { enum: ["admin", "member"] } }, ["posts", "nextBefore", "role"]),
  BookPath: S({ hands: int, municipalities: int, since: str, stations: list(S({ municipality: nullable(str), month: str })) }),
  BookNote: S({ id: uuid, body: str, first_name: nullable(str), month: str, hidden: bool, mine: bool }),
};

const ops: Op[] = [
  { method: "post", path: "/auth/email", tag: "Anmeldung", summary: "Anmeldelink per E-Mail anfordern (app=true: Link öffnet die iOS-App)", body: S({ email: str, next: str, app: bool }, ["email"]), auth: false },
  { method: "post", path: "/auth/email/verify", tag: "Anmeldung", summary: "Link einlösen. client=api liefert ein Bearer-Token", body: S({ token: str, client: { enum: ["web", "api"] } }, ["token"]), auth: false },
  { method: "post", path: "/auth/passkey/options", tag: "Anmeldung", summary: "Passkey-Anmeldung vorbereiten", auth: false },
  { method: "post", path: "/auth/passkey/verify", tag: "Anmeldung", summary: "Passkey-Anmeldung abschliessen", body: S({ challengeId: uuid, response: { type: "object" }, client: { enum: ["web", "api"] } }), auth: false },
  { method: "post", path: "/auth/logout", tag: "Anmeldung", summary: "Abmelden" },
  { method: "get", path: "/me", tag: "Konto", summary: "Eigenes Konto, Zahlen und ob Anfragen möglich sind" },
  { method: "post", path: "/me", tag: "Konto", summary: "Profil vervollständigen", body: S({ firstName: str, plz: str, birthDate: day }, ["firstName", "plz", "birthDate"]) },
  { method: "patch", path: "/me", tag: "Konto", summary: "Einstellungen (Ferienmodus, E-Mail-Typen, Ort, Puls: pulseShowNewBooks, Pinnwand per E-Mail und Push: pinboardNotify, Profilbild: avatarUploadId eines eigenen Uploads mit Zweck «avatar», null entfernt es)", body: S({ firstName: str, shelfPaused: bool, emailPrefs: { type: "object" }, plz: str, avatarUploadId: { type: ["string", "null"], format: "uuid" }, pulseShowNewBooks: bool, pinboardNotify: { enum: ["replies", "all", "off"] } }) },
  { method: "post", path: "/me/phone", tag: "Konto", summary: "SMS-Code anfordern", body: S({ phone: str }, ["phone"]) },
  { method: "post", path: "/me/phone/verify", tag: "Konto", summary: "SMS-Code bestätigen", body: S({ code: str }, ["code"]) },
  { method: "get", path: "/me/passkeys", tag: "Konto", summary: "Passkeys auflisten" },
  { method: "post", path: "/me/passkeys", tag: "Konto", summary: "Passkey registrieren (step options, dann verify)", body: S({ step: { enum: ["options", "verify"] }, response: { type: "object" }, name: str }) },
  { method: "delete", path: "/me/passkeys", tag: "Konto", summary: "Passkey entfernen (?id=)" },
  { method: "get", path: "/me/spots", tag: "Konto", summary: "Übergabeorte" },
  { method: "post", path: "/me/spots", tag: "Konto", summary: "Übergabeort anlegen (höchstens drei)", body: S({ label: str, detail: str, dropoff: bool }, ["label"]) },
  { method: "delete", path: "/me/spots", tag: "Konto", summary: "Übergabeort entfernen (?id=)" },
  { method: "get", path: "/me/export", tag: "Konto", summary: "Datenexport als JSON" },
  { method: "get", path: "/me/palette", tag: "Konto", summary: "Befehlspalette: eigene Bücher { id, title, authors } (max. 200), Kreise { id, name }, laufende Vorgänge { id, title, other_first_name, status, turn_is_mine } (max. 50)" },
  { method: "get", path: "/me/pulse", tag: "Gemeinschaft", summary: "Puls der letzten 7 Tage in meinen Kreisen (?circle= für einen Kreis). items: { type: moved, count } | { type: shelved, user { id, first_name, avatar_key }, count, circle { id, name } } | { type: post, post { id, kind, text, first_name, circle, title, created_at } }. Nur Aggregiertes oder selbst Veröffentlichtes" },
  { method: "post", path: "/me/delete", tag: "Konto", summary: "Konto löschen (nur ohne offene Vorgänge)" },
  { method: "get", path: "/notifications", tag: "Konto", summary: "Benachrichtigungen" },
  { method: "post", path: "/notifications", tag: "Konto", summary: "Als gelesen markieren", body: S({ ids: { type: "array", items: uuid }, all: bool, loanId: uuid }) },
  { method: "get", path: "/catalog/isbn/{isbn}", tag: "Katalog", summary: "Ausgabe zu ISBN (eigene DB, DNB, Open Library, Google Books)" },
  { method: "get", path: "/catalog/search", tag: "Katalog", summary: "Ausgaben im Katalog suchen (?q=)" },
  { method: "post", path: "/catalog/editions", tag: "Katalog", summary: "Buch von Hand erfassen", body: S({ title: str, authors: { type: "array", items: str }, year: int, language: str, publisher: str, genre: str, isbn: str }, ["title", "authors"]) },
  { method: "post", path: "/catalog/corrections", tag: "Katalog", summary: "Fehler in Titeldaten melden", body: S({ editionId: uuid, field: str, suggestion: str }) },
  { method: "get", path: "/search", tag: "Suche", summary: "Werke mit Exemplaren in der Nähe (?q, radius, offer, available, language, genre, condition, plz)", auth: false },
  { method: "get", path: "/works/{id}", tag: "Suche", summary: "Titelseite: Exemplare in der Nähe", auth: false },
  { method: "get", path: "/regions/plz/{plz}", tag: "Suche", summary: "Region offen? Bestand im Umkreis", auth: false },
  { method: "post", path: "/waitlist", tag: "Suche", summary: "Warteliste pro Postleitzahl", body: S({ email: str, plz: str }), auth: false },
  { method: "get", path: "/copies", tag: "Regal", summary: "Mein Regal" },
  { method: "post", path: "/copies", tag: "Regal", summary: "Buch einstellen", body: S({ editionId: uuid, condition: int, offers: { type: "array", items: { enum: ["lend", "swap", "gift"] } }, visibility: { enum: ["all", "proven", "circles"] }, loanDays: int, precious: bool, circleIds: { type: "array", items: uuid } }, ["editionId"]) },
  { method: "patch", path: "/copies", tag: "Regal", summary: "Mehrfachauswahl ändern", body: S({ ids: { type: "array", items: uuid } }, ["ids"]) },
  { method: "get", path: "/copies/{id}", tag: "Regal", summary: "Exemplar mit Verleihkalender", auth: false },
  { method: "patch", path: "/copies/{id}", tag: "Regal", summary: "Einstellungen eines Exemplars" },
  { method: "delete", path: "/copies/{id}", tag: "Regal", summary: "Aus dem Regal nehmen (rückgängig: POST /copies/{id}/restore)" },
  { method: "post", path: "/copies/{id}/restore", tag: "Regal", summary: "Entfernen rückgängig machen" },
  { method: "post", path: "/copies/{id}/photos", tag: "Regal", summary: "Foto anhängen", body: S({ uploadId: uuid }, ["uploadId"]) },
  { method: "post", path: "/copies/{id}/blocks", tag: "Regal", summary: "Sperrzeit im Kalender", body: S({ start: day, end: day, note: str }, ["start", "end"]) },
  { method: "delete", path: "/copies/{id}/blocks", tag: "Regal", summary: "Sperrzeit entfernen (?block=)" },
  { method: "get", path: "/copies/{id}/wishers", tag: "Gemeinschaft", summary: "Eigenes Exemplar: wer in meinen Kreisen dieses Buch sucht. { count, people: { id, first_name, circle_name } }" },
  { method: "get", path: "/copies/{id}/notes", tag: "Gemeinschaft", summary: "Zettel im Buch: notes { id, body, first_name (null = anonym), month (JJJJ-MM), hidden, mine }. Ausgeblendete nur für die Besitzerin", auth: false },
  { method: "get", path: "/copies/{id}/path", tag: "Gemeinschaft", summary: "Der Weg eines Buches, anonym: path { hands, municipalities, since (JJJJ-MM), stations: { municipality, month } } oder null unter zwei Übergaben", auth: false },
  { method: "patch", path: "/notes/{id}", tag: "Gemeinschaft", summary: "Zettel im eigenen Buch ausblenden oder wieder zeigen", body: S({ hidden: bool }, ["hidden"]) },
  { method: "get", path: "/users/{id}", tag: "Profil", summary: "Profil: drei Zahlen, Stufe, Regal", auth: false },
  { method: "get", path: "/loans", tag: "Vorgänge", summary: "Meine Vorgänge, nach Handlungsbedarf sortiert; je Vorgang unread (Benachrichtigungen), unread_messages (ungelesene Chatnachrichten), photo_color/cover_color (#rrggbb)" },
  { method: "post", path: "/loans", tag: "Vorgänge", summary: "Anfrage für einen Zeitraum, Tausch oder Geschenk", body: S({ copyId: uuid, kind: { enum: ["lend", "swap", "gift"] }, start: day, end: day, message: str, swapOfferedCopyIds: { type: "array", items: uuid } }, ["copyId"]) },
  { method: "get", path: "/loans/{id}", tag: "Vorgänge", summary: "Vorgang mit nächstem Schritt, Fristen, Verlauf" },
  { method: "post", path: "/loans/{id}/actions", tag: "Vorgänge", summary: "Handlung im Vorgang (siehe action)", body: S({ action: { enum: ["accept", "decline", "withdraw", "cancel", "cancel_without_penalty", "show_code", "enter_code", "report_handover", "confirm_handover", "object_handover", "condition_note", "extend", "grant_extension", "recall", "report_return", "confirm_return", "object_return", "complete", "report_damage", "open_case", "offer_swap", "accept_swap_offer", "clear_loss", "pass_on_consent", "start_earlier", "reschedule", "rate"] } }, ["action"]) },
  { method: "post", path: "/loans/{id}/note", tag: "Gemeinschaft", summary: "Zettel im Buch hinterlassen (≤ 200 Zeichen): nur die leihende Person, nach Abschluss während der Bewertungsfrist, einmal pro Leihe. GET /loans/{id} zeigt canLeaveNote und bookNote", body: S({ body: str, anonymous: bool }, ["body"]) },
  { method: "post", path: "/handover/redeem", tag: "Vorgänge", summary: "Gescannten QR-Code einlösen", body: S({ token: str }, ["token"]) },
  { method: "post", path: "/cases/{id}", tag: "Vorgänge", summary: "Antwort im Fall oder Ersatz bestätigen", body: S({ action: { enum: ["respond", "resolve"] }, response: str, outcome: str, detail: str, returnAt: str, swapCopyId: uuid }) },
  { method: "get", path: "/messages", tag: "Chat", summary: "Nachrichten (?loan= oder ?chat=, &after=<id> nur neuere, &id=<id> genau eine); reads: Lesestand der anderen Mitglieder { user_id, last_read_at }" },
  { method: "post", path: "/messages", tag: "Chat", summary: "Nachricht oder Terminvorschlag", body: S({ loan: uuid, chat: uuid, body: str, proposalPlace: str, proposalAt: { type: "string", format: "date-time" } }) },
  { method: "post", path: "/messages/read", tag: "Chat", summary: "Thread als gelesen markieren (bis upTo, sonst bis zur neuesten Nachricht; nur vorwärts). Antwort: { last_read_at }", body: S({ loan: uuid, chat: uuid, upTo: uuid }) },
  { method: "post", path: "/messages/{id}", tag: "Chat", summary: "Terminvorschlag annehmen" },
  { method: "get", path: "/messages/{id}/ics", tag: "Chat", summary: "Termin als Kalenderdatei" },
  { method: "get", path: "/stream", tag: "Chat", summary: "Server-Sent Events für Vorgang oder Übergabe-Chat (?loan= oder ?chat=). Ereignisse: message { id }, loan { event }, read { user_id, last_read_at }" },
  { method: "get", path: "/circles", tag: "Kreise", summary: "Meine Kreise" },
  { method: "post", path: "/circles", tag: "Kreise", summary: "Kreis gründen", body: S({ name: str, description: str, loanDays: int, autoAccept: bool, fixedSpot: str, joinMode: { enum: ["link", "approval"] } }, ["name"]) },
  { method: "get", path: "/circles/{id}", tag: "Kreise", summary: "Kreis mit Mitgliedern und Regal" },
  { method: "patch", path: "/circles/{id}", tag: "Kreise", summary: "Einstellungen, Einladungslink erneuern" },
  { method: "post", path: "/circles/{id}", tag: "Kreise", summary: "Mitglied freigeben, entfernen, Admin machen", body: S({ memberId: uuid, action: { enum: ["approve", "remove", "make_admin"] } }) },
  { method: "post", path: "/circles/join", tag: "Kreise", summary: "Beitritt per Einladungscode", body: S({ code: str }, ["code"]) },
  { method: "get", path: "/circles/{id}/posts", tag: "Gemeinschaft", summary: "Pinnwand des Kreises, neueste zuerst (?before=<nextBefore>&limit=, Standard 20). Antwort: { posts: PinPost[], nextBefore, role }. Zettel verfallen nach 60 Tagen aus der Ansicht, Suchen sobald erfüllt. Nur aktive Mitglieder" },
  { method: "post", path: "/circles/{id}/posts", tag: "Gemeinschaft", summary: "Zettel anheften. search: workId, neededBy?, text? (≤ 280). recommend: copyId (eigenes Exemplar im Kreisregal), text (≤ 280). announce (nur Admins): text (≤ 500), eventAt?, eventPlace? (≤ 120). Antwort: { id, post }", body: PostInput },
  { method: "get", path: "/circles/{id}/posts/{postId}", tag: "Gemeinschaft", summary: "Ein Zettel in der Form der Liste: { post: PinPost }" },
  { method: "patch", path: "/circles/{id}/posts/{postId}", tag: "Gemeinschaft", summary: "Suche als erfüllt markieren oder zurücknehmen (nur die suchende Person)", body: S({ fulfilled: bool }, ["fulfilled"]) },
  { method: "delete", path: "/circles/{id}/posts/{postId}", tag: "Gemeinschaft", summary: "Eigenen Zettel löschen; Admins des Kreises entfernen jeden" },
  { method: "post", path: "/circles/{id}/posts/{postId}/reactions", tag: "Gemeinschaft", summary: "Reaktion setzen: thanks («Danke») oder want («Will ich auch lesen», mit addToWishlist auch auf die Wunschliste). Antwort: { reactions: PinReactions, wishlisted }", body: S({ kind: { enum: ["thanks", "want"] }, addToWishlist: bool }, ["kind"]) },
  { method: "delete", path: "/circles/{id}/posts/{postId}/reactions", tag: "Gemeinschaft", summary: "Reaktion zurücknehmen (?kind=thanks|want). Antwort: { reactions: PinReactions }" },
  { method: "post", path: "/circles/{id}/posts/{postId}/comments", tag: "Gemeinschaft", summary: "Kommentar, eine Ebene, höchstens 500 Zeichen. Antwort: { id, post }", body: S({ body: str }, ["body"]) },
  { method: "delete", path: "/circles/{id}/posts/{postId}/comments", tag: "Gemeinschaft", summary: "Kommentar löschen (?comment=); eigene, Admins jeden" },
  { method: "post", path: "/circles/{id}/posts/{postId}/offer", tag: "Gemeinschaft", summary: "«Ich hab's»: eigenes Exemplar des gesuchten Werks anbieten. Kein Vorgang: die suchende Person wird benachrichtigt und fragt über POST /loans normal an. Antwort: { href, created }", body: S({ copyId: uuid }, ["copyId"]) },
  { method: "get", path: "/circles/{id}/posts/{postId}/ics", tag: "Gemeinschaft", summary: "Ankündigung mit Termin als Kalenderdatei" },
  { method: "get", path: "/circles/{id}/stream", tag: "Gemeinschaft", summary: "Server-Sent Events der Pinnwand. Ereignisse: ready, post { circle_id, post_id, op: insert | update | delete | reaction | comment }" },
  { method: "get", path: "/circles/{id}/wanted", tag: "Gemeinschaft", summary: "Brett «Gesucht im Kreis»: geteilte Wünsche anderer Mitglieder ohne Namen. wanted: { work_id, title, authors, cover_key, cover_w, cover_h, count, my_copy_id }" },
  { method: "get", path: "/wishlist", tag: "Wunschliste", summary: "Wunschliste (je Titel share_circles), Tauschtreffer und circleHits: Exemplare der Wunschtitel in den Regalen meiner Kreise { work_id, circle_id, circle_name, copy_id, owner_name, free_now, free_from }" },
  { method: "post", path: "/wishlist", tag: "Wunschliste", summary: "Titel vormerken, Titelalarm; shareCircles macht den Wunsch in meinen Kreisen sichtbar", body: S({ workId: uuid, radiusKm: int, shareCircles: bool }, ["workId"]) },
  { method: "patch", path: "/wishlist", tag: "Wunschliste", summary: "Umkreis, Alarm oder Sichtbarkeit im Kreis ändern", body: S({ workId: uuid, radiusKm: int, alarm: bool, shareCircles: bool }, ["workId"]) },
  { method: "delete", path: "/wishlist", tag: "Wunschliste", summary: "Entfernen (?work=)" },
  { method: "post", path: "/uploads", tag: "Dateien", summary: "Vorsignierten POST in den Bucket anfordern", body: S({ purpose: str, contentType: str, size: int, refId: uuid }, ["purpose", "contentType", "size"]) },
  { method: "post", path: "/uploads/{id}", tag: "Dateien", summary: "Upload abschliessen; Worker erzeugt AVIF/WebP" },
  { method: "get", path: "/uploads/{id}", tag: "Dateien", summary: "Stand der Verarbeitung" },
  { method: "put", path: "/uploads/{id}/content", tag: "Dateien", summary: "Rückfall-Upload über die API" },
  { method: "get", path: "/images/{key}", tag: "Dateien", summary: "Bildvariante (302 auf kurzlebige URL)", auth: false },
  { method: "post", path: "/reports", tag: "Sicherheit", summary: "Melden", body: S({ targetType: { enum: ["user", "message", "copy", "photo", "edition", "loan", "circle_post", "circle_post_comment", "book_note"] }, targetId: str, reason: { enum: ["harassment", "commercial", "inappropriate", "fake", "other"] }, note: str }, ["targetType", "targetId", "reason"]) },
  { method: "get", path: "/blocks", tag: "Sicherheit", summary: "Blockierungen" },
  { method: "post", path: "/blocks", tag: "Sicherheit", summary: "Blockieren", body: S({ userId: uuid }) },
  { method: "delete", path: "/blocks", tag: "Sicherheit", summary: "Blockierung aufheben (?user=)" },
  { method: "post", path: "/signals", tag: "Sonstiges", summary: "Nachfrage-Zähler (Versand gewünscht)", body: S({ key: { enum: ["shipping"] } }), auth: false },
  { method: "get", path: "/health", tag: "Betrieb", summary: "Healthcheck inkl. Fristenlauf", auth: false },
  { method: "get", path: "/mod", tag: "Moderation", summary: "Warteschlange, Kennzahlen, Schalter, Protokoll" },
  { method: "post", path: "/mod", tag: "Moderation", summary: "Entscheidungen der Moderation (u. a. hide_content: Pinnwand-Zettel, Kommentar oder Zettel im Buch ausblenden mit targetType, targetId, hidden)" },
  { method: "get", path: "/mod/loans/{id}", tag: "Moderation", summary: "Verlauf eines Vorgangs (Chat nur bei Fall oder Meldung, protokolliert)" },
  { method: "get", path: "/mod/users/{id}", tag: "Moderation", summary: "Konto-Dossier" },
];

export function GET() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const o of ops) {
    const params = [...o.path.matchAll(/\{(\w+)\}/g)].map((m) => ({ name: m[1], in: "path", required: true, schema: str }));
    paths[o.path] ??= {};
    paths[o.path][o.method] = {
      tags: [o.tag],
      summary: o.summary,
      ...(params.length ? { parameters: params } : {}),
      ...(o.body ? { requestBody: { required: true, content: { "application/json": { schema: o.body } } } } : {}),
      ...(o.auth === false ? { security: [] } : {}),
      responses: {
        "200": { description: "OK" },
        "401": { $ref: "#/components/responses/Error" },
        "403": { $ref: "#/components/responses/Error" },
        "404": { $ref: "#/components/responses/Error" },
        "409": { $ref: "#/components/responses/Error" },
        "422": { $ref: "#/components/responses/Error" },
      },
    };
  }
  return Response.json({
    openapi: "3.1.0",
    info: {
      title: "Leihregal API",
      version: "1.0.0",
      description:
        "Einzige Schreibschnittstelle für Web und iOS. Fehler haben immer die Form { error: { code, message } }; die Meldung sagt, was zu tun ist. " +
        `Vorgangsstatus: ${LOAN_STATUSES.join(", ")}. Handlungen der Zustandsmaschine: ${ACTIONS.join(", ")}.`,
    },
    servers: [{ url: `${env.appUrl}/api/v1` }],
    security: [{ cookie: [] }, { bearer: [] }],
    components: {
      securitySchemes: {
        cookie: { type: "apiKey", in: "cookie", name: "lr_session" },
        bearer: { type: "http", scheme: "bearer", description: "Sitzungstoken aus /auth/email/verify mit client=api" },
      },
      schemas,
      responses: {
        Error: {
          description: "Fehler",
          content: { "application/json": { schema: S({ error: S({ code: str, message: str, details: {} }, ["code", "message"]) }, ["error"]) } },
        },
      },
    },
    paths,
  });
}
