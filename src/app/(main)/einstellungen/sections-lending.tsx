"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/client";
import { useToast } from "@/components/toast";
import { Button, Check, Field, Input, Switch, cx } from "@/components/ui";
import { itemCls, listCls, msg, useT } from "./sections-shared";

/** Einstellungen, Bereich Leihen: Übergabeorte, Ferienmodus, Blockierte Personen */
/* ----------------------------------------------------------- Übergabeorte */
type Spot = { id: string; label: string; detail: string | null; dropoff: boolean };

export function SpotList({ spots }: { spots: Spot[] }) {
  const T = useT();
  const t = T.spots;
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [detail, setDetail] = useState("");
  const [dropoff, setDropoff] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = spots.length >= 3;

  async function add(e: FormEvent) {
    e.preventDefault();
    if (label.trim().length < 2) return setError(t.labelShort);
    setBusy(true);
    setError(null);
    try {
      await api("/me/spots", { body: { label: label.trim(), detail: detail.trim() || null, dropoff } });
      setLabel(""); setDetail(""); setDropoff(false); setOpen(false);
      toast.show({ text: t.saved });
      router.refresh();
    } catch (e) {
      setError(msg(e, T));
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: Spot) {
    try {
      await api(`/me/spots?id=${s.id}`, { method: "DELETE" });
      router.refresh();
      toast.show({
        text: t.removed(s.label),
        undo: async () => {
          await api("/me/spots", { body: { label: s.label, detail: s.detail, dropoff: s.dropoff } });
          router.refresh();
        },
      });
    } catch (e) {
      toast.error(msg(e, T));
    }
  }

  return (
    <div>
      {spots.length > 0 ? (
        <ul className={listCls}>
          {spots.map((s) => (
            <li key={s.id} className={itemCls}>
              <span className="min-w-0">
                <span className="block text-[15px]">{s.label}</span>
                <span className="block text-sm text-muted">
                  {s.detail ? <>{t.visibleAfter}{s.detail}</> : t.noDetail}
                  {s.dropoff && t.dropoffAllowed}
                </span>
              </span>
              <Button variant="quiet" className="text-sm shrink-0 h-10 px-3" onClick={() => remove(s)}>{T.remove}</Button>
            </li>
          ))}
        </ul>
      ) : !open && (
        <p className="text-ink-2 mb-5 text-[15px]">{t.none}</p>
      )}

      {full ? (
        <p className="text-sm text-muted">{t.full}</p>
      ) : open ? (
        <form onSubmit={add} className="flex flex-col gap-5 anim-rise border-t border-line pt-5" noValidate>
          <Field label={t.label} hint={t.labelHint} error={error}>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder={t.labelPlaceholder} autoFocus />
          </Field>
          <Field label={t.detail} hint={t.detailHint}>
            <Input value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={200} placeholder={t.detailPlaceholder} />
          </Field>
          <Check checked={dropoff} onChange={setDropoff} label={t.dropoff} />
          <div className="flex items-center gap-5">
            <Button type="submit" variant="primary" disabled={busy}>{busy ? T.saving : t.save}</Button>
            <Button type="button" variant="quiet" onClick={() => { setOpen(false); setError(null); }}>{T.cancel}</Button>
          </div>
        </form>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>{t.add}</Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ Ferienmodus */
export function ShelfPause({ paused }: { paused: boolean }) {
  const T = useT();
  const t = T.pause;
  const router = useRouter();
  const toast = useToast();
  const [on, setOn] = useState(paused);
  useEffect(() => setOn(paused), [paused]);

  async function set(v: boolean, undoable = true) {
    setOn(v);
    try {
      await api("/me", { method: "PATCH", body: { shelfPaused: v } });
      router.refresh();
      if (undoable) toast.show({ text: v ? t.paused : t.reopened, undo: () => set(!v, false) });
    } catch (e) {
      setOn(!v);
      toast.error(msg(e, T));
    }
  }

  return (
    <div className={cx("rounded-[10px] border px-4 transition-colors duration-300", on ? "bg-lent/10 border-lent/30" : "bg-paper border-line")}>
      <Switch checked={on} onChange={(v) => set(v)} label={<span className="font-medium">{t.label}</span>} hint={on ? t.hintOn : t.hintOff} />
    </div>
  );
}

/* ---------------------------------------------------- Blockierte Personen */
export function BlockList({ blocks }: { blocks: { id: string; name: string; since: string }[] }) {
  const T = useT();
  const t = T.blocks;
  const router = useRouter();
  const toast = useToast();

  async function unblock(b: { id: string; name: string }) {
    try {
      await api(`/blocks?user=${b.id}`, { method: "DELETE" });
      router.refresh();
      toast.show({
        text: t.lifted(b.name),
        undo: async () => { await api("/blocks", { body: { userId: b.id } }); router.refresh(); },
      });
    } catch (e) {
      toast.error(msg(e, T));
    }
  }

  if (!blocks.length) return <p className="text-ink-2 text-[15px]">{t.none}</p>;
  return (
    <ul className="space-y-2">
      {blocks.map((b) => (
        <li key={b.id} className={itemCls}>
          <span className="min-w-0">
            <span className="block text-[15px]">{b.name}</span>
            <span className="block text-sm text-muted">{t.since(b.since)}</span>
          </span>
          <Button variant="quiet" className="text-sm shrink-0 h-10 px-3" onClick={() => unblock(b)}>{t.lift}</Button>
        </li>
      ))}
    </ul>
  );
}

