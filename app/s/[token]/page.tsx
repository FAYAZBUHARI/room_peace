"use client";

import { use } from "react";
import { Stepper } from "@/components/Stepper";
import { TopBar } from "@/components/TopBar";
import { PrivateConversations } from "@/components/ConversationStage";
import { useSeat } from "@/components/useSeat";

export default function SeatPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const handle = useSeat(token);

  const v = handle.view;

  if (handle.notFound) {
    return (
      <>
        <TopBar />
        <main className="shell page" style={{ paddingTop: 48 }}>
          <p className="lede">This link doesn&apos;t match a room. Ask your roommates for a new one, or start a new room.</p>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar chip={v?.demo ? "Demo · fictional data" : "Private link · don't share it"} />
      <main className="shell page" style={{ paddingTop: 28, gap: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="eyebrow">Your private room</span>
            <h1 className="display" style={{ fontSize: "var(--t-2xl)" }}>
              {v ? <>Hi {v.me.name}, <em>let&apos;s sort it out.</em></> : <>&nbsp;</>}
            </h1>
          </div>
          <Stepper view={v} />
        </div>
        <PrivateConversations handle={handle} />
      </main>
    </>
  );
}
