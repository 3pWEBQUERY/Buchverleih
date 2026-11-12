/** Zentrale Konfiguration. Alle Werte kommen aus Railway-Variablen pro Umgebung. */
function bool(v: string | undefined, d = false) {
  if (v == null || v === "") return d;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

let warnedAppUrl = false;

export const env = {
  get appUrl() {
    const raw = process.env.APP_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "");
    if (raw) return raw.replace(/\/$/, "");
    // In Produktion würden Links in E-Mails sonst still auf localhost zeigen
    if (process.env.NODE_ENV === "production" && !warnedAppUrl) {
      warnedAppUrl = true;
      console.error("[env] APP_URL fehlt (und RAILWAY_PUBLIC_DOMAIN): Links in E-Mails und Push zeigen auf localhost. Setze APP_URL auf web und worker.");
    }
    return "http://localhost:3000";
  },
  /** true, wenn eine öffentliche Adresse gesetzt ist (APP_URL oder RAILWAY_PUBLIC_DOMAIN) */
  get appUrlConfigured() {
    return Boolean(process.env.APP_URL || process.env.RAILWAY_PUBLIC_DOMAIN);
  },
  get production() {
    return process.env.NODE_ENV === "production";
  },
  /** Anmeldelinks und Codes in der Antwort zeigen – nur in der Entwicklung, in Produktion nie. */
  get showCodes() {
    return process.env.NODE_ENV !== "production" && bool(process.env.DEV_SHOW_CODES, false);
  },
  get smtpUrl() {
    return process.env.SMTP_URL || "";
  },
  get mailFrom() {
    return process.env.MAIL_FROM || "Leihregal <hallo@leihregal.ch>";
  },
  get smsProvider() {
    return (process.env.SMS_PROVIDER || "console") as "console" | "webhook";
  },
  /** Google Books API-Schlüssel (Railway-Variable, nie im Code). Ohne Schlüssel gilt das knappe anonyme Kontingent. */
  get googleBooksKey() {
    return process.env.GOOGLE_BOOKS_API_KEY || "";
  },
  /** Original-Cover laden (Open Library, Google Books). Standard: an. */
  get covers() {
    return bool(process.env.COVERS, true);
  },
  s3: {
    // Railway-Buckets liefern eigene Variablennamen; beide Schreibweisen werden akzeptiert.
    get bucket() {
      return process.env.S3_BUCKET || process.env.BUCKET || "";
    },
    get endpoint() {
      return process.env.S3_ENDPOINT || process.env.ENDPOINT || "";
    },
    get region() {
      return process.env.S3_REGION || process.env.REGION || "auto";
    },
    get accessKeyId() {
      return process.env.S3_ACCESS_KEY_ID || process.env.ACCESS_KEY_ID || "";
    },
    get secretAccessKey() {
      return process.env.S3_SECRET_ACCESS_KEY || process.env.SECRET_ACCESS_KEY || "";
    },
    get forcePathStyle() {
      return bool(process.env.S3_FORCE_PATH_STYLE, false);
    },
    get configured() {
      return Boolean(this.bucket && this.endpoint && this.accessKeyId && this.secretAccessKey);
    },
  },
};
