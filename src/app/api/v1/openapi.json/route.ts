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

const ops: Op[] = [
  { method: "post", path: "/auth/email", tag: "Anmeldung", summary: "Anmeldelink per E-Mail anfordern (app=true: Link öffnet die iOS-App)", body: S({ email: str, next: str, app: bool }, ["email"]), auth: false },
  { method: "post", path: "/auth/email/verify", tag: "Anmeldung", summary: "Link einlösen. client=api liefert ein Bearer-Token", body: S({ token: str, client: { enum: ["web", "api"] } }, ["token"]), auth: false },
  { method: "post", path: "/auth/register", tag: "Anmeldung", summary: "Konto mit E-Mail und Passwort anlegen. client=api liefert ein Bearer-Token", body: S({ email: str, password: str, client: { enum: ["web", "api"] } }, ["email", "password"]), auth: false },
  { method: "post", path: "/auth/password", tag: "Anmeldung", summary: "Anmelden mit E-Mail und Passwort. client=api liefert ein Bearer-Token", body: S({ email: str, password: str, client: { enum: ["web", "api"] } }, ["email", "password"]), auth: false },
  { method: "post", path: "/auth/passkey/options", tag: "Anmeldung", summary: "Passkey-Anmeldung vorbereiten", auth: false },
  { method: "post", path: "/auth/passkey/verify", tag: "Anmeldung", summary: "Passkey-Anmeldung abschliessen", body: S({ challengeId: uuid, response: { type: "object" }, client: { enum: ["web", "api"] } }), auth: false },
  { method: "post", path: "/auth/logout", tag: "Anmeldung", summary: "Abmelden" },
  { method: "get", path: "/me", tag: "Konto", summary: "Eigenes Konto, Zahlen und ob Anfragen möglich sind" },
  { method: "post", path: "/me", tag: "Konto", summary: "Profil vervollständigen", body: S({ firstName: str, plz: str, birthDate: day }, ["firstName", "plz", "birthDate"]) },
  { method: "patch", path: "/me", tag: "Konto", summary: "Einstellungen (Ferienmodus, E-Mail-Typen, Ort, Profilbild: avatarUploadId eines eigenen Uploads mit Zweck «avatar», null entfernt es)", body: S({ firstName: str, shelfPaused: bool, emailPrefs: { type: "object" }, plz: str, avatarUploadId: { type: ["string", "null"], format: "uuid" } }) },
  { method: "post", path: "/me/phone", tag: "Konto", summary: "SMS-Code anfordern", body: S({ phone: str }, ["phone"]) },
  { method: "post", path: "/me/phone/verify", tag: "Konto", summary: "SMS-Code bestätigen", body: S({ code: str }, ["code"]) },
  { method: "post", path: "/me/password", tag: "Konto", summary: "Passwort setzen oder ändern", body: S({ password: str }, ["password"]) },
  { method: "get", path: "/me/passkeys", tag: "Konto", summary: "Passkeys auflisten" },
  { method: "post", path: "/me/passkeys", tag: "Konto", summary: "Passkey registrieren (step options, dann verify)", body: S({ step: { enum: ["options", "verify"] }, response: { type: "object" }, name: str }) },
  { method: "delete", path: "/me/passkeys", tag: "Konto", summary: "Passkey entfernen (?id=)" },
  { method: "get", path: "/me/spots", tag: "Konto", summary: "Übergabeorte" },
  { method: "post", path: "/me/spots", tag: "Konto", summary: "Übergabeort anlegen (höchstens drei)", body: S({ label: str, detail: str, dropoff: bool }, ["label"]) },
  { method: "delete", path: "/me/spots", tag: "Konto", summary: "Übergabeort entfernen (?id=)" },
  { method: "get", path: "/me/export", tag: "Konto", summary: "Datenexport als JSON" },
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
  { method: "get", path: "/users/{id}", tag: "Profil", summary: "Profil: drei Zahlen, Stufe, Regal", auth: false },
  { method: "get", path: "/loans", tag: "Vorgänge", summary: "Meine Vorgänge, nach Handlungsbedarf sortiert" },
  { method: "post", path: "/loans", tag: "Vorgänge", summary: "Anfrage für einen Zeitraum, Tausch oder Geschenk", body: S({ copyId: uuid, kind: { enum: ["lend", "swap", "gift"] }, start: day, end: day, message: str, swapOfferedCopyIds: { type: "array", items: uuid } }, ["copyId"]) },
  { method: "get", path: "/loans/{id}", tag: "Vorgänge", summary: "Vorgang mit nächstem Schritt, Fristen, Verlauf" },
  { method: "post", path: "/loans/{id}/actions", tag: "Vorgänge", summary: "Handlung im Vorgang (siehe action)", body: S({ action: { enum: ["accept", "decline", "withdraw", "cancel", "cancel_without_penalty", "show_code", "enter_code", "report_handover", "confirm_handover", "object_handover", "condition_note", "extend", "grant_extension", "recall", "report_return", "confirm_return", "object_return", "complete", "report_damage", "open_case", "offer_swap", "accept_swap_offer", "clear_loss", "pass_on_consent", "start_earlier", "reschedule", "rate"] } }, ["action"]) },
  { method: "post", path: "/handover/redeem", tag: "Vorgänge", summary: "Gescannten QR-Code einlösen", body: S({ token: str }, ["token"]) },
  { method: "post", path: "/cases/{id}", tag: "Vorgänge", summary: "Antwort im Fall oder Ersatz bestätigen", body: S({ action: { enum: ["respond", "resolve"] }, response: str, outcome: str, detail: str, returnAt: str, swapCopyId: uuid }) },
  { method: "get", path: "/messages", tag: "Chat", summary: "Nachrichten (?loan= oder ?chat=)" },
  { method: "post", path: "/messages", tag: "Chat", summary: "Nachricht oder Terminvorschlag", body: S({ loan: uuid, chat: uuid, body: str, proposalPlace: str, proposalAt: { type: "string", format: "date-time" } }) },
  { method: "post", path: "/messages/{id}", tag: "Chat", summary: "Terminvorschlag annehmen" },
  { method: "get", path: "/messages/{id}/ics", tag: "Chat", summary: "Termin als Kalenderdatei" },
  { method: "get", path: "/stream", tag: "Chat", summary: "Server-Sent Events für Vorgang oder Übergabe-Chat" },
  { method: "get", path: "/circles", tag: "Kreise", summary: "Meine Kreise" },
  { method: "post", path: "/circles", tag: "Kreise", summary: "Kreis gründen", body: S({ name: str, description: str, loanDays: int, autoAccept: bool, fixedSpot: str, joinMode: { enum: ["link", "approval"] } }, ["name"]) },
  { method: "get", path: "/circles/{id}", tag: "Kreise", summary: "Kreis mit Mitgliedern und Regal" },
  { method: "patch", path: "/circles/{id}", tag: "Kreise", summary: "Einstellungen, Einladungslink erneuern" },
  { method: "post", path: "/circles/{id}", tag: "Kreise", summary: "Mitglied freigeben, entfernen, Admin machen", body: S({ memberId: uuid, action: { enum: ["approve", "remove", "make_admin"] } }) },
  { method: "post", path: "/circles/join", tag: "Kreise", summary: "Beitritt per Einladungscode", body: S({ code: str }, ["code"]) },
  { method: "get", path: "/wishlist", tag: "Wunschliste", summary: "Wunschliste und Tauschtreffer" },
  { method: "post", path: "/wishlist", tag: "Wunschliste", summary: "Titel vormerken, Titelalarm", body: S({ workId: uuid, radiusKm: int }, ["workId"]) },
  { method: "patch", path: "/wishlist", tag: "Wunschliste", summary: "Umkreis oder Alarm ändern" },
  { method: "delete", path: "/wishlist", tag: "Wunschliste", summary: "Entfernen (?work=)" },
  { method: "post", path: "/uploads", tag: "Dateien", summary: "Vorsignierten POST in den Bucket anfordern", body: S({ purpose: str, contentType: str, size: int, refId: uuid }, ["purpose", "contentType", "size"]) },
  { method: "post", path: "/uploads/{id}", tag: "Dateien", summary: "Upload abschliessen; Worker erzeugt AVIF/WebP" },
  { method: "get", path: "/uploads/{id}", tag: "Dateien", summary: "Stand der Verarbeitung" },
  { method: "put", path: "/uploads/{id}/content", tag: "Dateien", summary: "Rückfall-Upload über die API" },
  { method: "get", path: "/images/{key}", tag: "Dateien", summary: "Bildvariante (302 auf kurzlebige URL)", auth: false },
  { method: "post", path: "/reports", tag: "Sicherheit", summary: "Melden", body: S({ targetType: str, targetId: str, reason: str, note: str }) },
  { method: "get", path: "/blocks", tag: "Sicherheit", summary: "Blockierungen" },
  { method: "post", path: "/blocks", tag: "Sicherheit", summary: "Blockieren", body: S({ userId: uuid }) },
  { method: "delete", path: "/blocks", tag: "Sicherheit", summary: "Blockierung aufheben (?user=)" },
  { method: "post", path: "/signals", tag: "Sonstiges", summary: "Nachfrage-Zähler (Versand gewünscht)", body: S({ key: { enum: ["shipping"] } }), auth: false },
  { method: "get", path: "/health", tag: "Betrieb", summary: "Healthcheck inkl. Fristenlauf", auth: false },
  { method: "get", path: "/mod", tag: "Moderation", summary: "Warteschlange, Kennzahlen, Schalter, Protokoll, Konten, Team (?view=queue|kpis|flags|log|users|team)" },
  { method: "post", path: "/mod", tag: "Moderation", summary: "Entscheidungen der Moderation" },
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
