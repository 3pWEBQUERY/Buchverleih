import { VerifyLink } from "./verify";

export const metadata = { title: "Anmelden" };

/** Der Link wird erst per Knopfdruck eingelöst, damit Vorschauen von Mailprogrammen ihn nicht verbrauchen. */
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string; next?: string }> }) {
  const { token, next } = await searchParams;
  return (
    <div className="max-w-md md:ml-[8.33%] pt-10">
      <h1 className="display text-5xl">Willkommen zurück.</h1>
      <VerifyLink token={token ?? ""} next={next ?? null} />
    </div>
  );
}
