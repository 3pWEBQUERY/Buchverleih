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
import { shelfStatusText } from "@/components/status";
import { useToast } from "@/components/toast";
import { Button, Check, Field, Input, Notice, Segmented, Switch, Textarea, cx } from "@/components/ui";
import { IconArrowLeft, IconCamera, IconCheck, IconClose } from "@/components/icons";

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

  const coverData = { title: copy.title, authors: copy.authors, photoKey: photo?.key, photoW: photo?.width, photoH: photo?.height, coverKey: copy.cover_key, seed: copy.work_id };
  const dot = { ok: "bg-ok", lent: "bg-lent", late: "bg-late", wait: "bg-wait", done: "bg-done", accent: "bg-accent" }[st.tone];

  return (
    <div>
      <Link href="/regal" className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-muted hover:text-ink transition-colors mb-6 md:mb-8 min-h-11 -my-2">
        <IconArrowLeft width={16} height={16} /> Mein Regal
      </Link>

      <header className="grid grid-cols-[auto_minmax(0,1fr)] gap-5 md:gap-10 items-end mb-10 md:mb-14">
        <Link href={`/exemplar/${copy.id}`} className="book block anim-cover" aria-label="So sehen es andere">
          <span className="book-face block md:hidden"><Cover priority data={coverData} height={140} /></span>
          <span className="book-face hidden md:block"><Cover priority large data={coverData} height={232} /></span>
        </Link>
        <div className="min-w-0 anim-rise" style={{ animationDelay: "60ms" }}>
          <p className="eyebrow">Buch bearbeiten</p>
          <h1 lang="de" className="display text-[38px] md:text-[76px] mt-2.5 md:mt-3 break-words hyphens-auto">{copy.title}</h1>
          <p className="text-[15px] md:text-[17px] text-ink-2 mt-2">{copy.authors.join(", ")}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="chip"><span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", dot)} />{st.text}</span>
            <Link href={`/exemplar/${copy.id}`} className="text-[13.5px] font-medium text-muted hover:text-ink link-grow">So sehen es andere</Link>
          </div>
        </div>
      </header>

      <p className="text-[13.5px] text-muted mb-4 flex items-center gap-2"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ok" /> Jede Änderung wird sofort gespeichert.</p>

      <div className="space-y-4 md:space-y-5">
        <Group title="Zustand und Fotos" i={0}>
          <Row label="Zustand" hint={conditionHint[s.condition]}>
            <Segmented name="Zustand" size="lg" value={s.condition} onChange={(v) => save({ condition: v })}
              options={[1, 2, 3, 4].map((c) => ({ value: c, label: conditionLabel[c], hint: conditionHint[c] }))} />
          </Row>
          <Row label="Notiz" hint={<>Zum Beispiel «Widmung auf Seite 1». <span className="tnum">{200 - note.length}</span> Zeichen frei.</>}>
            <Textarea rows={2} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Notiz zum Zustand"
              onBlur={() => { const v = note.trim() || null; if (v !== (s.conditionNote ?? null)) save({ conditionNote: v }); }} />
          </Row>
          <Row label="Fotos" hint={copy.photos.length ? "Das erste Foto ersetzt das Cover." : "Zeig Zustand und Ausgabe. Ohne Foto erscheint das Cover."}>
            <Photos copy={copy} />
          </Row>
        </Group>

        <Group title="Angebot und Sichtbarkeit" i={1}>
          <Row label="Angebot" hint={<>
            {s.offers.length === 0
              ? "Nicht angeboten: Das Buch steht in deinem Regal, andere sehen es nicht."
              : `Mehrere möglich. Andere können es ${s.offers.map((o) => ({ lend: "leihen", swap: "tauschen", gift: "geschenkt bekommen" })[o]).join(", ").replace(/, ([^,]*)$/, " oder $1")}.`}
            {locked && <span className="block mt-1">Du hast es geschenkt bekommen. Tauschen und Verschenken geht ab {fmtDay(locked)}.</span>}
          </>}>
            <div role="group" aria-label="Angebotsarten" className="grid grid-cols-3 gap-1 p-1 bg-paper-2 rounded-full">
              {OFFERS.map((o) => {
                const on = s.offers.includes(o);
                return (
                  <button key={o} type="button" aria-pressed={on}
                    onClick={() => save({ offers: OFFERS.filter((x) => (x === o ? !on : s.offers.includes(x))) })}
                    className={cx("h-10 rounded-full text-[13.5px] font-semibold inline-flex items-center justify-center gap-1.5 transition-[background-color,color] duration-200", on ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-3")}>
                    {on && <IconCheck width={14} height={14} strokeWidth={2.2} className="anim-pop" />}{offerLabel[o]}
                  </button>
                );
              })}
            </div>
          </Row>
          <Row label="Wer es sieht" hint={VIS_HINT[s.visibility]}>
            <Segmented name="Sichtbarkeit" value={s.visibility} onChange={(v) => save({ visibility: v })}
              options={(["all", "proven", "circles"] as const).map((v) => ({ value: v, label: visibilityLabel[v] }))} />
          </Row>
          <Row label="In meinen Kreisen" hint="Ausgewählte Kreise zeigen das Buch in ihrem gemeinsamen Regal.">
            {circles.length === 0 ? (
              <p className="text-[15px] text-ink-2">Du bist in keinem Kreis. <Link href="/kreise/neu" className="font-medium underline underline-offset-4 hover:text-ink">Kreis gründen</Link></p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {circles.map((c) => (
                  <Check key={c.id} checked={s.circleIds.includes(c.id)} label={c.name}
                    className="min-h-11 pl-3 pr-4 rounded-full border border-line has-[:checked]:border-ink transition-colors"
                    onChange={(v) => save({ circleIds: v ? [...s.circleIds, c.id] : s.circleIds.filter((x) => x !== c.id) })} />
                ))}
              </div>
            )}
            {s.visibility === "circles" && s.circleIds.length === 0 && (
              <Notice tone="late" className="mt-4">Kein Kreis ausgewählt. So sieht das Buch niemand. Wähle mindestens einen Kreis.</Notice>
            )}
          </Row>
        </Group>

        <Group title="Leihe" i={2}>
          <Row label="Leihfrist" hint={circleDays.length > 0
            ? `In ${circleDays.length === 1 ? `«${circleDays[0].name}»` : "deinen Kreisen"} gilt die Leihfrist des Kreises${circleDays.length === 1 ? ` (${circleDays[0].loanDays} Tage)` : ""}.`
            : "So lange darf jemand das Buch behalten."}>
            <Segmented name="Leihfrist" value={s.loanDays} onChange={(v) => save({ loanDays: v })}
              options={([14, 28, 42, 56] as const).map((d) => ({ value: d, label: `${d} Tage` }))} />
          </Row>
          <SwitchRow>
            <Switch checked={s.autoExtend} onChange={(v) => save({ autoExtend: v })} label={<span className="font-semibold">Verlängerung automatisch gewähren</span>}
              hint="Um 14 Tage, wenn der Kalender danach frei ist. Sonst fragt die Person bei dir an." />
          </SwitchRow>
          <Row label="Höchstens so oft verlängern">
            <Segmented name="Höchstens so oft verlängern" value={s.maxExtensions} onChange={(v) => save({ maxExtensions: v })}
              options={[0, 1, 2].map((n) => ({ value: n, label: n === 0 ? "Nie" : `${n}×` }))} />
          </Row>
          <SwitchRow>
            <Switch checked={s.dropoffAllowed} onChange={(v) => save({ dropoffAllowed: v })} label={<span className="font-semibold">Ablage erlaubt</span>}
              hint="Übergabe über Milchkasten oder Briefkasten, mit Foto der Ablage." />
          </SwitchRow>
        </Group>

        <Group title="Verleihkalender" i={3}>
          <div className="py-5 md:py-6">
            <CalendarView cal={calendar} />
            <BlockForm copyId={copy.id} calendar={calendar} />
          </div>
          <Row label="Buchbar im Voraus">
            <Segmented name="Buchungshorizont" value={s.horizonDays} onChange={(v) => save({ horizonDays: v })}
              options={([30, 60, 90, 180] as const).map((d) => ({ value: d, label: `${d} Tage` }))} />
          </Row>
          <Row label="Puffer zwischen zwei Leihen" hint="In Tagen. Zeit für Rückgabe und nächste Übergabe.">
            <Segmented name="Puffer in Tagen" value={s.bufferDays} onChange={(v) => save({ bufferDays: v })}
              options={range(0, 7).map((n) => ({ value: n, label: String(n) }))} />
          </Row>
          <Row label="Künftige Buchungen höchstens">
            <Segmented name="Künftige Buchungen" value={s.maxFutureBookings} onChange={(v) => save({ maxFutureBookings: v })}
              options={range(1, 6).map((n) => ({ value: n, label: String(n) }))} />
          </Row>
        </Group>

        <Group title="Direkte Weitergabe" desc="Das Buch geht vom einen Leiher direkt zum nächsten, ohne Umweg über dich." i={4}>
          <Row label="Weitergabe" hint={s.passOn === "never" ? "Jede Leihe geht über dich." : s.passOn === "on_request" ? "Du wirst bei jeder Folgeleihe gefragt." : "Du stimmst jeder Weitergabe im Voraus zu. Die beiden Leihenden werden trotzdem gefragt."}>
            <Segmented name="Direkte Weitergabe" value={s.passOn} onChange={(v) => save({ passOn: v })}
              options={(["never", "on_request", "always"] as const).map((v) => ({ value: v, label: passOnLabel[v] }))} />
          </Row>
          <div className={cx("transition-opacity", s.passOn === "never" && "opacity-45 pointer-events-none")} aria-disabled={s.passOn === "never"}>
            <Row label="Danach zurück zu mir" hint="Nach so vielen Weitergaben in Folge kommt das Buch zu dir zurück.">
              <Segmented name="Kettenlänge" value={s.chainMax} onChange={(v) => save({ chainMax: v })}
                options={range(1, 4).map((n) => ({ value: n, label: String(n) }))} />
            </Row>
          </div>
        </Group>

        <section className="panel-quiet !rounded-[18px] px-5 md:px-8 py-6 md:py-7 grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-x-10 gap-y-4 items-center" aria-label="Aus dem Regal nehmen">
          <div>
            <h2 className="ui-title text-[17px]">Aus dem Regal nehmen</h2>
            <p className="text-[14px] text-muted mt-1">Das Buch verschwindet aus deinem Regal und aus allen Kreisen. Offene Anfragen verfallen.</p>
          </div>
          <div>
            <Button variant="ghost" className="!text-late !border-late/40 hover:!border-late hover:!bg-late/[0.06]" disabled={removing} onClick={remove}>
              Aus dem Regal nehmen
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

/** Gruppe als Fläche mit Titel; darin Zeilen mit Haarlinien */
function Group({ title, desc, children, i = 0 }: { title: string; desc?: ReactNode; children: ReactNode; i?: number }) {
  const id = `grp-${title.toLowerCase().replace(/[^a-zäöü]+/g, "-")}`;
  return (
    <section className="panel !rounded-[18px] px-5 md:px-8 anim-rise" style={{ animationDelay: `${i * 40}ms` }} aria-labelledby={id}>
      <div className="pt-6 md:pt-7 pb-1">
        <h2 id={id} className="ui-title text-[20px] md:text-[22px]">{title}</h2>
        {desc && <p className="text-[14px] text-muted mt-1 max-w-xl">{desc}</p>}
      </div>
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}

/** Desktop: Label und Erklärung links, Steuerung rechts. Mobil untereinander. */
function Row({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-x-10 gap-y-3 py-5 md:py-6">
      <div>
        <p className="text-[15px] font-semibold leading-snug">{label}</p>
        {hint && <p className="text-[14px] text-muted mt-1 leading-snug">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function SwitchRow({ children }: { children: ReactNode }) {
  return <div className="py-2 md:py-3">{children}</div>;
}

function Photos({ copy, className }: { copy: CopyDetail; className?: string }) {
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
      {photos.length > 0 && (
        <ul className="flex flex-wrap gap-3 mb-3">
          {photos.map((p) => (
            <li key={p.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl(p.key)} alt={`Foto von ${copy.title}`} className="h-24 w-auto rounded-[6px] outline outline-1 -outline-offset-1 outline-black/10" />
              <button type="button" onClick={() => remove(p.id)} aria-label="Foto entfernen"
                className="absolute -top-2 -right-2 h-6 w-6 grid place-items-center rounded-full bg-paper border border-line-strong text-muted hover:text-ink hover:border-ink">
                <IconClose width={13} height={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className={cx("inline-flex items-center gap-2 h-10 px-4 border border-line-strong rounded-full text-[14px] font-semibold cursor-pointer hover:border-ink hover:bg-paper-2 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus)]", uploading && "opacity-45 pointer-events-none")}>
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
        <ul className="panel-quiet divide-y divide-line px-4 mb-4" aria-label="Sperrzeiten">
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
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>Sperrzeit eintragen</Button>
      ) : (
        <form onSubmit={submit} className="panel-quiet !rounded-[14px] p-4 md:p-5 anim-rise">
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

