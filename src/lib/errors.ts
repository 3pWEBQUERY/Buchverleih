/**
 * Fachliche Fehler. Die Meldung sagt immer, was zu tun ist (PRD 8.3, Punkt 6).
 */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const err = {
  unauthorized: () => new AppError(401, "unauthorized", "Bitte melde dich an."),
  forbidden: (msg = "Dafür fehlt dir die Berechtigung.") => new AppError(403, "forbidden", msg),
  notFound: (msg = "Nicht gefunden.") => new AppError(404, "not_found", msg),
  conflict: (code: string, msg: string) => new AppError(409, code, msg),
  invalid: (msg: string, details?: unknown) => new AppError(422, "invalid", msg, details),
  tooMany: (msg = "Zu viele Versuche. Warte einen Moment und versuche es erneut.") => new AppError(429, "rate_limited", msg),
  stale: () =>
    new AppError(409, "stale", "Dieser Schritt ist nicht mehr möglich. Lade die Seite neu, um den aktuellen Stand zu sehen."),
};
