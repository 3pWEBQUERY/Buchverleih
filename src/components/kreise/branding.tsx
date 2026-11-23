"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, uploadPhoto } from "@/lib/client";
import { BRAND_COLORS } from "@/lib/monogram-colors";
import { STATS } from "@/lib/i18n/messages/stats";
import { useLocale } from "@/components/locale-provider";
import { useToast } from "@/components/toast";
import { Button, cx } from "@/components/ui";
import { CircleMark } from "./circle-mark";

/** Organisationen: Farbe und Logo des Kreises */
export function Branding({ circleId, name, color, logo }: { circleId: string; name: string; color: string | null; logo: string | null }) {
  const t = STATS[useLocale()].org;
  const router = useRouter();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await api(`/circles/${circleId}`, { method: "PATCH", body });
      toast.show({ text: t.saved }, 2500);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-8">
      <p className="font-medium">{t.brand}</p>
      <p className="text-body-sm text-muted mt-0.5 mb-4">{t.brandDesc}</p>
      <div className="flex flex-wrap items-start gap-6">
        <CircleMark id={circleId} name={name} size={72} color={color} logo={logo} />
        <div className="space-y-4">
          <div role="radiogroup" aria-label={t.color} className="flex flex-wrap gap-2">
            {BRAND_COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} disabled={busy}
                onClick={() => patch({ brandColor: color === c ? null : c })}
                className={cx("h-9 w-9 rounded-sm outline-offset-2 transition-[outline]", color === c ? "outline outline-2 outline-ink" : "outline outline-1 outline-line hover:outline-ink-2")}
                style={{ background: c }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => file.current?.click()}>{t.upload}</Button>
            {logo && <Button size="sm" variant="quiet" disabled={busy} onClick={() => patch({ logoUploadId: null })}>{t.remove}</Button>}
            <input ref={file} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setBusy(true);
              try {
                const up = await uploadPhoto(f, "avatar");
                await patch({ logoUploadId: up.id });
              } catch (err) {
                toast.error((err as Error).message);
                setBusy(false);
              }
            }} />
          </div>
        </div>
      </div>
    </div>
  );
}
