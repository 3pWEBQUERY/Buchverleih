"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { CopyDetail } from "@/lib/copies";
import type { Calendar } from "@/lib/loans/calendar";
import type { OfferKind } from "@/lib/loans/machine";
import { api, uploadPhoto } from "@/lib/client";
import { addDays, dayToDate, fmtDay, fmtRange, todayCH } from "@/lib/dates";
import { conditionHint, conditionLabel, offerLabel, passOnLabel, visibilityLabel } from "@/lib/i18n/de-CH";
import { CalendarView } from "@/components/calendar";
import { Cover, imageUrl } from "@/components/cover";
import { StatusText, shelfStatusText } from "@/components/status";
import { useToast } from "@/components/toast";
import { Button, Check, Field, Input, Notice, Segmented, Switch, Textarea, cx } from "@/components/ui";
import { IconArrowLeft, IconCamera, IconClose } from "@/components/icons";

type Settings = {
  condition: number;
  conditionNote: string | null;
  offers: OfferKind[];
  visibility: CopyDetail["visibility"];
  circleIds: string[];
  loanDays: 14 | 28 | 42 | 56;
  autoExtend: boolean;
  maxExtensions: number;
  horizonDays: 30 | 60 | 90 | 180;
  bufferDays: number;
  maxFutureBookings: number;
  passOn: CopyDetail["pass_on"];
  chainMax: number;
  dropoffAllowed: boolean;
};

const OFFERS: OfferKind[] = ["lend", "swap", "gift"];
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

const VIS_HINT = {
  all: "Alle Mitglieder in der Umgebung sehen das Buch und können es anfragen.",
  proven: "Nur Mitglieder ab der Stufe Bewährt, also mit drei pünktlichen Leihen, und deine Kreise.",
  circles: "Nur Mitglieder der Kreise, die du unten auswählst.",
} as const;

export function CopyEditor({ copy, calendar, circles }: { copy: CopyDetail; calendar: Calendar; circles: { id: string; name: string; loanDays: number }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [s, setS] = useState<Settings>({
    condition: copy.condition,
    conditionNote: copy.condition_note,
    offers: copy.offers,
    visibility: copy.visibility,
    circleIds: copy.circle_ids,
    loanDays: copy.loan_days as Settings["loanDays"],
    autoExtend: copy.auto_extend,
    maxExtensions: copy.max_extensions,
    horizonDays: copy.horizon_days as Settings["horizonDays"],
    bufferDays: copy.buffer_days,
    maxFutureBookings: copy.max_future_bookings,
    passOn: copy.pass_on,
    chainMax: copy.chain_max,
    dropoffAllowed: copy.dropoff_allowed,
  });
  const [note, setNote] = useState(copy.condition_note ?? "");
  const [removing, setRemoving] = useState(false);

  /** Optimistisch speichern: sofort anzeigen, bei Fehler zurücksetzen. */
  async function save(patch: Partial<Settings>) {
    const before = Object.fromEntries(Object.keys(patch).map((k) => [k, s[k as keyof Settings]])) as Partial<Settings>;
    setS((cur) => ({ ...cur, ...patch }));
    try {
      await api(`/copies/${copy.id}`, { method: "PATCH", body: patch });
      toast.show({ text: "Gespeichert" }, 1800);
      router.refresh();
    } catch (e) {
      setS((cur) => ({ ...cur, ...before }));
      toast.error((e as Error).message);
    }
  }

  async function remove() {
    setRemoving(true);
    try {
      await api(`/copies/${copy.id}`, { method: "DELETE" });
      toast.show(
        {
          text: `«${copy.title}» ist nicht mehr in deinem Regal.`,
          undo: async () => {
            try {
              await api(`/copies/${copy.id}/restore`, { method: "POST" });
              router.push(`/regal/${copy.id}`);
            } catch (e) {
              toast.error((e as Error).message);
            }
          },
        },
        7000,
      );
      router.push("/regal");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
      setRemoving(false);
    }
  }

  const st = shelfStatusText(copy);
  const photo = copy.photos[0];
  const locked = copy.transfer_locked_until && new Date(copy.transfer_locked_until) > new Date() ? copy.transfer_locked_until : null;
  const circleDays = circles.filter((c) => s.circleIds.includes(c.id));

  return (
    <div>
      <Link href="/regal" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink mb-6 md:mb-8">
        <IconArrowLeft width={16} height={16} /> Mein Regal
      </Link>

      <div className="grid md:grid-cols-12 gap-x-12 gap-y-8">
        <aside className="md:col-span-4">
          <div className="md:sticky md:top-12 flex md:block gap-5 items-end">
            <div className="anim-cover flex-none">
              <span className="md:hidden">
                <Cover priority data={{ title: copy.title, authors: copy.authors, photoKey: photo?.key, photoW: photo?.width, photoH: photo?.height, coverKey: copy.cover_key, seed: copy.work_id }} height={150} />
              </span>
              <span className="hidden md:block">
                <Cover large priority width={240} className="max-w-full" data={{ title: copy.title, authors: copy.authors, photoKey: photo?.key, photoW: photo?.width, photoH: photo?.height, coverKey: copy.cover_key, seed: copy.work_id }} />
              </span>
            </div>
            <div className="min-w-0 md:hidden pb-1">
              <StatusText tone={st.tone}>{st.text}</StatusText>
              <Link href={`/exemplar/${copy.id}`} className="block text-sm text-muted hover:underline mt-2">So sehen es andere</Link>
            </div>
            <Photos copy={copy} className="hidden md:block mt-6" />
          </div>
        </aside>

        <div className="md:col-span-8 min-w-0">
          <header>
            <h1 className="display text-4xl md:text-6xl">{copy.title}</h1>
            <p className="text-lg text-ink-2 mt-3">{copy.authors.join(", ")}</p>
            <div className="hidden md:flex flex-wrap gap-x-5 gap-y-2 items-center mt-4">
              <StatusText tone={st.tone}>{st.text}</StatusText>
              <Link href={`/exemplar/${copy.id}`} className="text-sm text-muted hover:underline">So sehen es andere</Link>
            </div>
            <p className="text-sm text-muted mt-4">Jede Änderung wird sofort gespeichert.</p>
          </header>

          <Part title="Zustand">
            <Segmented name="Zustand" size="lg" value={s.condition} onChange={(v) => save({ condition: v })}
              options={[1, 2, 3, 4].map((c) => ({ value: c, label: conditionLabel[c], hint: conditionHint[c] }))} />
            <p className="text-sm text-muted mt-2">{conditionHint[s.condition]}</p>
            <Field label="Notiz" hint={`Zum Beispiel «Widmung auf Seite 1». ${200 - note.length} Zeichen frei.`} className="mt-6">
              <Textarea rows={2} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)}
                onBlur={() => { const v = note.trim() || null; if (v !== (s.conditionNote ?? null)) save({ conditionNote: v }); }} />
            </Field>
          </Part>

          <Part title="Angebot" hint="Mehrere möglich.">
            <div role="group" aria-label="Angebotsarten" className="grid grid-cols-3 border border-line-strong rounded-sm overflow-hidden">
              {OFFERS.map((o, i) => {
                const on = s.offers.includes(o);
                return (
                  <button key={o} type="button" aria-pressed={on}
                    onClick={() => save({ offers: OFFERS.filter((x) => (x === o ? !on : s.offers.includes(x))) })}
                    className={cx("h-11 text-sm transition-colors duration-150", i > 0 && "border-l border-line-strong", on ? "bg-ink text-paper" : "hover:bg-paper-3")}>
                    {offerLabel[o]}
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-muted mt-2">
              {s.offers.length === 0
                ? "Nicht angeboten: Das Buch steht in deinem Regal, andere sehen es nicht."
                : `Andere können es ${s.offers.map((o) => ({ lend: "leihen", swap: "tauschen", gift: "geschenkt bekommen" })[o]).join(", ").replace(/, ([^,]*)$/, " oder $1")}.`}
            </p>
            {locked && (
              <p className="text-sm text-muted mt-1">Du hast es geschenkt bekommen. Tauschen und Verschenken geht ab {fmtDay(locked)}.</p>
            )}
          </Part>

          <Part title="Wer es sieht">
            <Segmented name="Sichtbarkeit" value={s.visibility} onChange={(v) => save({ visibility: v })}
              options={(["all", "proven", "circles"] as const).map((v) => ({ value: v, label: visibilityLabel[v] }))} />
            <p className="text-sm text-muted mt-2">{VIS_HINT[s.visibility]}</p>

            <div className="mt-6">
              <p className="text-sm font-medium mb-1">In meinen Kreisen</p>
              {circles.length === 0 ? (
                <p className="text-sm text-muted">Du bist in keinem Kreis. <Link href="/kreise/neu" className="underline underline-offset-4 hover:text-ink">Kreis gründen</Link></p>
              ) : (
                <>
                  <p className="text-sm text-muted mb-2">Ausgewählte Kreise zeigen das Buch in ihrem gemeinsamen Regal.</p>
                  <ul className="divide-y divide-line border-y border-line">
                    {circles.map((c) => (
                      <li key={c.id} className="py-2.5">
                        <Check checked={s.circleIds.includes(c.id)} label={c.name}
                          onChange={(v) => save({ circleIds: v ? [...s.circleIds, c.id] : s.circleIds.filter((x) => x !== c.id) })} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {s.visibility === "circles" && s.circleIds.length === 0 && (
                <Notice tone="late" className="mt-4">Kein Kreis ausgewählt. So sieht das Buch niemand. Wähle mindestens einen Kreis.</Notice>
              )}
            </div>
          </Part>

          <Part title="Leihe">
            <Field label="Leihfrist">
              <Segmented name="Leihfrist" value={s.loanDays} onChange={(v) => save({ loanDays: v })}
                options={([14, 28, 42, 56] as const).map((d) => ({ value: d, label: `${d} Tage` }))} />
            </Field>
            {circleDays.length > 0 && (
              <p className="text-sm text-muted mt-2">
                In {circleDays.length === 1 ? `«${circleDays[0].name}»` : "deinen Kreisen"} gilt die Leihfrist des Kreises{circleDays.length === 1 ? ` (${circleDays[0].loanDays} Tage)` : ""}.
              </p>
            )}
            <div className="mt-4 divide-y divide-line border-y border-line">
              <Switch checked={s.autoExtend} onChange={(v) => save({ autoExtend: v })} label="Verlängerung automatisch gewähren"
                hint="Um 14 Tage, wenn der Kalender danach frei ist. Sonst fragt die Person bei dir an." />
              <div className="py-3">
                <p className="text-[15px] mb-2">Höchstens so oft verlängern</p>
                <Segmented name="Höchstens so oft verlängern" value={s.maxExtensions} onChange={(v) => save({ maxExtensions: v })}
                  options={[0, 1, 2].map((n) => ({ value: n, label: n === 0 ? "Nie" : `${n}×` }))} className="max-w-xs" />
              </div>
              <Switch checked={s.dropoffAllowed} onChange={(v) => save({ dropoffAllowed: v })} label="Ablage erlaubt"
                hint="Übergabe über Milchkasten oder Briefkasten, mit Foto der Ablage." />
            </div>
          </Part>

          <Part title="Verleihkalender">
            <CalendarView cal={calendar} />
            <BlockForm copyId={copy.id} calendar={calendar} />

            <div className="mt-8 grid gap-6">
              <Field label="Buchbar im Voraus">
                <Segmented name="Buchungshorizont" value={s.horizonDays} onChange={(v) => save({ horizonDays: v })}
                  options={([30, 60, 90, 180] as const).map((d) => ({ value: d, label: `${d} Tage` }))} />
              </Field>
              <Field label="Puffer zwischen zwei Leihen" hint="Zeit für Rückgabe und nächste Übergabe.">
                <Segmented name="Puffer in Tagen" value={s.bufferDays} onChange={(v) => save({ bufferDays: v })}
                  options={range(0, 7).map((n) => ({ value: n, label: String(n) }))} />
              </Field>
              <Field label="Künftige Buchungen höchstens">
                <Segmented name="Künftige Buchungen" value={s.maxFutureBookings} onChange={(v) => save({ maxFutureBookings: v })}
                  options={range(1, 6).map((n) => ({ value: n, label: String(n) }))} />
              </Field>
            </div>
          </Part>

          <Part title="Direkte Weitergabe" hint="Das Buch geht vom einen Leiher direkt zum nächsten, ohne Umweg über dich.">
            <Segmented name="Direkte Weitergabe" value={s.passOn} onChange={(v) => save({ passOn: v })}
              options={(["never", "on_request", "always"] as const).map((v) => ({ value: v, label: passOnLabel[v] }))} />
            <p className="text-sm text-muted mt-2">
              {s.passOn === "never" ? "Jede Leihe geht über dich." : s.passOn === "on_request" ? "Du wirst bei jeder Folgeleihe gefragt." : "Du stimmst jeder Weitergabe im Voraus zu. Die beiden Leihenden werden trotzdem gefragt."}
            </p>
            <div className={cx("mt-6 transition-opacity", s.passOn === "never" && "opacity-45 pointer-events-none")} aria-disabled={s.passOn === "never"}>
              <Field label="Danach zurück zu mir" hint="Nach so vielen Weitergaben in Folge kommt das Buch zu dir zurück.">
                <Segmented name="Kettenlänge" value={s.chainMax} onChange={(v) => save({ chainMax: v })}
                  options={range(1, 4).map((n) => ({ value: n, label: String(n) }))} className="max-w-sm" />
              </Field>
            </div>
          </Part>

          <Photos copy={copy} className="md:hidden py-8 border-t border-line" heading />

          <Part title="Aus dem Regal nehmen">
            <p className="text-[15px] text-ink-2">Das Buch verschwindet aus deinem Regal und aus allen Kreisen. Offene Anfragen verfallen.</p>
            <Button variant="danger" className="mt-4" disabled={removing} onClick={remove}>
              Aus dem Regal nehmen
            </Button>
          </Part>
        </div>
      </div>
    </div>
  );
}

function Part({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-10 pt-8 border-t border-line" aria-label={title}>
      <h2 className="text-xl md:text-2xl">{title}</h2>
      {hint && <p className="text-sm text-muted mt-1">{hint}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Photos({ copy, className, heading }: { copy: CopyDetail; className?: string; heading?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const photos = copy.photos.filter((p) => !hidden.has(p.id));

  async function add(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const up = await uploadPhoto(file, "copy_photo", copy.id);
      await api(`/copies/${copy.id}/photos`, { body: { uploadId: up.id } });
      toast.show({ text: "Foto hinzugefügt" }, 2000);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function remove(id: string) {
    setHidden((h) => new Set(h).add(id));
    // Erst nach Ablauf der Rückgängig-Frist wirklich löschen
    const t = setTimeout(async () => {
      try {
        await api(`/copies/${copy.id}/photos?photo=${id}`, { method: "DELETE" });
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    }, 5000);
    toast.show({
      text: "Foto entfernt",
      undo: () => {
        clearTimeout(t);
        setHidden((h) => {
          const n = new Set(h);
          n.delete(id);
          return n;
        });
      },
    });
  }

  return (
    <div className={className}>
      {heading ? <h2 className="text-xl mb-1">Fotos</h2> : <p className="text-sm font-medium mb-1">Fotos</p>}
      <p className="text-sm text-muted mb-3">{photos.length ? "Das erste Foto ersetzt das Cover." : "Zeig Zustand und Ausgabe. Ohne Foto erscheint das Cover."}</p>
      {photos.length > 0 && (
        <ul className="flex flex-wrap gap-3 mb-3">
          {photos.map((p) => (
            <li key={p.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl(p.key)} alt={`Foto von ${copy.title}`} className="h-24 w-auto rounded-xs outline outline-1 -outline-offset-1 outline-black/10" />
              <button type="button" onClick={() => remove(p.id)} aria-label="Foto entfernen"
                className="absolute -top-2 -right-2 h-6 w-6 grid place-items-center rounded-full bg-paper border border-line-strong text-muted hover:text-ink hover:border-ink">
                <IconClose width={13} height={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className={cx("inline-flex items-center gap-2 h-9 px-3 border border-ink rounded-sm text-sm font-medium cursor-pointer hover:bg-ink hover:text-paper transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus)]", uploading && "opacity-45 pointer-events-none")}>
        <IconCamera width={16} height={16} /> {uploading ? "Wird hochgeladen …" : "Foto hinzufügen"}
        <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={uploading}
          onChange={(e) => { add(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
    </div>
  );
}

function BlockForm({ copyId, calendar }: { copyId: string; calendar: Calendar }) {
  const router = useRouter();
  const toast = useToast();
  const today = todayCH();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(today);
  const [last, setLast] = useState(addDays(today, 13));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const blocks = calendar.bars.filter((b) => b.kind === "block" && (!b.note || !b.note.startsWith("Tausch ")));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (last < start) {
      toast.error("Der letzte Tag liegt vor dem ersten. Prüfe die beiden Daten.");
      return;
    }
    setBusy(true);
    try {
      await api(`/copies/${copyId}/blocks`, { body: { start, end: addDays(last, 1), note: note.trim() || undefined } });
      toast.show({ text: `Gesperrt: ${fmtRange({ start, end: addDays(last, 1) })}` }, 2500);
      setOpen(false);
      setNote("");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(b: Calendar["bars"][number]) {
    try {
      await api(`/copies/${copyId}/blocks?block=${b.id}`, { method: "DELETE" });
      router.refresh();
      toast.show({
        text: "Sperrzeit entfernt",
        undo: async () => {
          try {
            await api(`/copies/${copyId}/blocks`, { body: { start: b.start, end: b.end, note: b.note ?? undefined } });
            router.refresh();
          } catch (err) {
            toast.error((err as Error).message);
          }
        },
      });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="mt-5">
      {blocks.length > 0 && (
        <ul className="divide-y divide-line border-y border-line mb-4" aria-label="Sperrzeiten">
          {blocks.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-4 py-2.5 text-[15px]">
              <span>
                <span>{fmtRange({ start: b.start, end: b.end })}</span>
                <span className="text-muted">{b.note ? ` · ${b.note}` : " · gesperrt"}</span>
              </span>
              <Button variant="quiet" className="text-sm" onClick={() => remove(b)}>Entfernen</Button>
            </li>
          ))}
        </ul>
      )}
      {!open ? (
        <Button variant="ghost" size="sm" className="-ml-3" onClick={() => setOpen(true)}>Sperrzeit eintragen</Button>
      ) : (
        <form onSubmit={submit} className="border-t border-line pt-5 anim-rise">
          <p className="text-sm text-muted mb-4">Zeiten, in denen du das Buch selbst brauchst, zum Beispiel zum Lesen oder in den Ferien.</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Erster Tag">
              <Input type="date" value={start} min={today} onChange={(e) => setStart(e.target.value)} required />
            </Field>
            <Field label="Letzter Tag">
              <Input type="date" value={last} min={start} onChange={(e) => setLast(e.target.value)} required />
            </Field>
          </div>
          <Field label="Notiz" hint="Nur für dich sichtbar." className="mt-4">
            <Input value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} placeholder="Selbst lesen" />
          </Field>
          <div className="flex items-center gap-3 mt-5">
            <Button type="submit" disabled={busy}>Sperrzeit eintragen</Button>
            <Button type="button" variant="quiet" onClick={() => setOpen(false)}>Abbrechen</Button>
          </div>
          {start && last >= start && (
            <p className="text-sm text-muted mt-3">{fmtDay(dayToDate(start))} bis und mit {fmtDay(dayToDate(last))}, {Math.round((dayToDate(last).getTime() - dayToDate(start).getTime()) / 86_400_000) + 1} Tage.</p>
          )}
        </form>
      )}
    </div>
  );
}

