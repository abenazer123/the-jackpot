/**
 * /chat/session — the full-page conversational inquiry surface.
 *
 * Replaces the old layered <dialog> that sat over the marketing hero.
 * The entry chips on /chat navigate here (with ?intent=share|reserve);
 * because the chat now owns the whole viewport there is no background
 * page to scroll behind it, which was the iOS scroll bug.
 *
 * Session lifecycle is unchanged: the session id is minted by the first
 * /api/inquiry-agent/turn call. This route does not yet carry the id in
 * the URL (a deep-linkable /chat/c/[id] with reload-resume is a clean
 * follow-up on this same surface).
 */

"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { InquiryChatThread } from "@/components/brand/InquiryChatThread";

function ChatSession() {
  const router = useRouter();
  const params = useSearchParams();
  const intentParam = params.get("intent");
  const initialIntent =
    intentParam === "share" || intentParam === "reserve" ? intentParam : null;

  return (
    <InquiryChatThread
      open
      onClose={() => router.push("/chat")}
      initialIntent={initialIntent}
    />
  );
}

export default function ChatSessionPage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <ChatSession />
    </Suspense>
  );
}
