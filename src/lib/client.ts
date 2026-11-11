"use client";
/** Client-Zugriff auf die API. Alle Schreibzugriffe laufen über /api/v1 (PRD 10.2). */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
    headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: "same-origin",
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new ApiError(res.status, data?.error?.code ?? "error", data?.error?.message ?? "Etwas ist schiefgelaufen. Versuche es erneut.");
  }
  return data as T;
}

/** Foto in den Bucket laden: vorsignierter POST, bei Bedarf Rückfall über die API. */
export async function uploadPhoto(file: File, purpose: string, refId?: string): Promise<{ id: string; key: string }> {
  const type = file.type || "image/jpeg";
  const prep = await api<{ id: string; key: string; post: { url: string; fields: Record<string, string> }; proxy: string }>("/uploads", {
    body: { purpose, contentType: type, size: file.size, refId },
  });
  let ok = false;
  try {
    const form = new FormData();
    Object.entries(prep.post.fields).forEach(([k, v]) => form.append(k, v));
    form.append("file", file);
    const r = await fetch(prep.post.url, { method: "POST", body: form });
    ok = r.ok;
  } catch {
    ok = false;
  }
  if (!ok) {
    const r = await fetch(prep.proxy, { method: "PUT", body: file, headers: { "content-type": type } });
    if (!r.ok) throw new ApiError(r.status, "upload", "Das Foto konnte nicht hochgeladen werden. Prüfe die Verbindung und versuche es erneut.");
  }
  await api(`/uploads/${prep.id}`, { method: "POST" });
  return { id: prep.id, key: prep.key };
}
