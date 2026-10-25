"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { Seat } from "@/lib/types";
import { SEATS } from "@/lib/types";
import { DEMO_LINES } from "@/lib/demo";
import type { SeatHandle } from "./useSeat";
import { SeatPanel } from "./SeatPanel";
import { ExchangePanel } from "./ExchangePanel";

/** Keep each pane mounted so its composer, previews and pending work stay with its seat. */
function PhoneView({ active, id, children }: { active: boolean; id: string; children: React.ReactNode }) {
  const positions = useRef(new Map<Element, number>());
  useLayoutEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(() => positions.current.forEach((top, el) => { el.scrollTop = top; }));
    return () => cancelAnimationFrame(frame);
  }, [active]);
  return <div id={id} hidden={!active} className="single-phone-view" onScrollCapture={e => {
    const el = e.target as HTMLElement;
    if (active && el.clientHeight) positions.current.set(el, el.scrollTop);
  }}>{children}</div>;
}

function ConversationPhone({ participants, shared, demo = false }: { participants: { seat: Seat; handle: SeatHandle }[]; shared: SeatHandle; demo?: boolean }) {
  const [active, setActive] = useState<string>(participants[0].seat);
  return <div className="single-conversation-stage">
    <motion.div className="phone-wrap" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="phone-frame single-phone">
        <div className="phone-status" aria-hidden="true"><span>RoomPeace</span><span className="phone-notch" /><span>● ▰</span></div>
        <div className="phone-view-picker">
          <label htmlFor="conversation-view">Conversation</label>
          <select id="conversation-view" value={active} aria-controls={`conversation-${active}`} onChange={e => setActive(e.target.value)}>
            {participants.map(({ seat, handle }) => <option key={seat} value={seat}>{handle.view ? `${handle.view.me.name}’s Chat` : "Loading chat…"}</option>)}
          </select>
        </div>
        {participants.map(({ seat, handle }) => <PhoneView key={seat} id={`conversation-${seat}`} active={active === seat}>
          <SeatPanel handle={handle} suggestions={demo ? DEMO_LINES[seat] : []} />
        </PhoneView>)}
        <div className="phone-home" aria-hidden="true" />
      </div>
    </motion.div>
    <section className="separate-negotiation" aria-label="Agent Negotiation">
      <h2 className="phone-owner">Agent Negotiation</h2>
      <ExchangePanel handle={shared} compact onOpenSeat={demo ? seat => setActive(seat) : undefined} />
    </section>
  </div>;
}

export function DemoConversations({ handles }: { handles: Record<Seat, SeatHandle> }) {
  return <ConversationPhone participants={SEATS.map(seat => ({ seat, handle: handles[seat] }))} shared={handles.a} demo />;
}

/** Only the authorized handle is supplied; other private chats are never fetched. */
export function PrivateConversations({ handle }: { handle: SeatHandle }) {
  if (!handle.view) return <div className="single-conversation-stage" aria-busy="true">Loading your conversation…</div>;
  return <ConversationPhone participants={[{ seat: handle.view.seat, handle }]} shared={handle} />;
}
