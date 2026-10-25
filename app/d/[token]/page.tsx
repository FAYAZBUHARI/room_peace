"use client";

import { motion } from "framer-motion";
import { use, useEffect, useState } from "react";
import { Stepper } from "@/components/Stepper";
import { TopBar } from "@/components/TopBar";
import { DemoConversations } from "@/components/ConversationStage";
import { useSeat } from "@/components/useSeat";

export default function DemoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [seats, setSeats] = useState<{ a: string; b: string; c: string } | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    fetch(`/api/demo/${token}`).then(async (r) => (r.ok ? setSeats(await r.json()) : setMissing(true)));
  }, [token]);
  const handles = { a: useSeat(seats?.a ?? null), b: useSeat(seats?.b ?? null), c: useSeat(seats?.c ?? null) };
  const anyView = handles.a.view;

  if (missing) {
    return (
      <>
        <TopBar />
        <main className="shell page" style={{ paddingTop: 48 }}><p className="lede">Demo not found. Start a new one from the home page.</p></main>
      </>
    );
  }

  return (
    <>
      <TopBar chip="Demo · fictional data" />
      <main className="shell page" style={{ paddingTop: 28, gap: 12 }}>
        <motion.div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 760 }}>
            <span className="eyebrow">Live demo · you play all three roommates</span>
            <h1 className="display" style={{ fontSize: "var(--t-2xl)" }}>
              <em className="grad-iris">Max</em>, <em className="grad-ember">Jordan</em> and <em className="grad-rose">Sam</em> share one bathroom.
            </h1>
            <p className="lede" style={{ fontSize: "var(--t-base)" }}>
              Three separate Gemini agents. Choose a roommate’s private chat from the dropdown inside the phone.
              The separate Agent Negotiation panel shows only approved information and shared activity.
            </p>
          </div>
          <Stepper view={anyView} />
        </motion.div>

        <DemoConversations handles={handles} />
      </main>
    </>
  );
}
