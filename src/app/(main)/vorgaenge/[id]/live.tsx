"use client";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Chat } from "@/components/loan/chat";

/** Chat plus Live-Aktualisierung der Seite, wenn sich der Status ändert. */
export function LiveChat(props: { loanId: string; me: string; initial: Parameters<typeof Chat>[0]["initial"]; readOnly: boolean; defaultPlace: string | null }) {
  const router = useRouter();
  const onEvent = useCallback(() => router.refresh(), [router]);
  return <Chat thread={{ loan: props.loanId }} me={props.me} initial={props.initial} readOnly={props.readOnly} defaultPlace={props.defaultPlace} onEvent={onEvent} />;
}
