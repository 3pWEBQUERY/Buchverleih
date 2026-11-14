"use client";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Chat } from "@/components/loan/chat";

export function HandoverChat(props: { id: string; me: string; initial: Parameters<typeof Chat>[0]["initial"]; readOnly: boolean; defaultPlace: string | null; initialReads?: Parameters<typeof Chat>[0]["initialReads"]; quick?: Parameters<typeof Chat>[0]["quick"] }) {
  const router = useRouter();
  const onEvent = useCallback(() => router.refresh(), [router]);
  return <Chat thread={{ chat: props.id }} me={props.me} initial={props.initial} readOnly={props.readOnly} memberCount={3} defaultPlace={props.defaultPlace} initialReads={props.initialReads} quick={props.quick} onEvent={onEvent} />;
}
