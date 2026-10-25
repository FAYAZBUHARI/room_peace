# RoomPeace

demo video - https://drive.google.com/file/d/1wMkBncwtRzVuXd2tP6DrbRaCU6_NYJfU/view?usp=sharing

Three personal AI agents that help three roommates agree on household responsibilities, privately. Supports Track 2 (agent-to-agent coordination) and Track 3 (Group Chat Assistant) through the same interface.

Each roommate talks only to their own agent. The existing **Agent negotiation** tab is the prototype group conversation. The agents trade just the facts each student approved, summarize concerns neutrally, separate shared facts/preferences/constraints/assumptions, identify schedule conflicts, and offer two or three options. Nothing becomes final until all three students approve the same version. There are no external chat or calendar integrations.

## Run it

```bash
cp .env.example .env.local   # then set GEMINI_API_KEY (.env also works; both are gitignored)
npm install
npm run dev
```

Open http://localhost:3000 and either:

- **Start the demo**: fictional roommates Max, Jordan and Sam in four switchable tabs: one private chat per roommate plus an **Agent negotiation** tab. Sending a message (or approving a sharing preview) jumps to the negotiation tab; switch back any time. Tabs show live status and unread badges. All three agents are real.
- **Start a room for three**: enter three names and get three private links. Each link opens two tabs: that roommate's private agent and the negotiation.

Run it as one long-lived Node server (`npm run dev` or `npm run build && npm start`). Rooms live in memory and are mirrored to `.data/rooms.json`. The negotiation runs in the background inside that process, so serverless hosting isn't supported yet.

## How it works

| Piece | What it does |
|---|---|
| Intake agent (one per student) | Chats privately, then drafts a **sharing preview**: one fact per item, each labelled (availability, constraint, preference, flexibility, reason, complaint). |
| Sharing preview | The student checks exactly what leaves the chat. Reasons and complaints start **unchecked**. |
| Negotiating agents | Take turns (round-robin) proposing, accepting, countering or declining. A proposal becomes a draft only when **both other agents** accept it. Each agent is built **only** from approved facts plus the shared exchange, and never receives anyone's private chat. |
| Agreement card | Responsibilities, deadlines, version and each person's approval status. |
| Change requests | A student asks for a change. Their agent drafts the new terms and the student previews them before sending them as a new version. |
| Follow-up | Each student marks only their own part done and can opt into an in-app or browser reminder 2 hours before their deadline. |
| Rotation notifications | Tasks run in deadline order. When a roommate marks his part done, Cubbie notifies the other two in their chats, tells whoever is next "It's now your turn", and announces when the rotation is complete. Roommates with reminders on also get a browser notification. |

All agents call the Gemini API through Google's `@google/genai` SDK, using JSON-schema output; every response is also validated with zod before the engine uses it. The default model is `gemini-flash-latest`; set `GEMINI_MODEL` to pin another one. If it's overloaded, rate-limited or takes longer than 20 seconds, the call falls back to `GEMINI_FALLBACK_MODEL` (default `gemini-flash-lite-latest`, set it empty to disable).

Demo rooms run on a fixed clock (the upcoming Thursday, 2 PM) so the scenario's "tomorrow" and "Saturday's turn" read as intended on any day. Real rooms use the real time.

### Rules the server enforces (not left to the model)

- Only approved facts reach the negotiation. Private chat never enters a negotiator's prompt.
- Negotiation starts only once all three students have approved a sharing preview.
- An agent's "accept" only counts toward a **draft**, which needs both other agents. Nobody is committed until they approve it themselves, and it is confirmed only when all three approve.
- Approvals are tied to one version number. Any edit creates a new version, which voids earlier approvals. A browser tab showing an old draft can't approve a newer one.
- After **3 declined proposals** the agents pause and ask each student what they'd change.
- If all three students say "nothing will change", or another 3 proposals are declined after the pause, the result is **no agreement**. That's a valid outcome.
- New approved information invalidates pending approvals and causes the agents to reconsider the plan. In-flight results based on older shared information are discarded.
- Amendments are tied to the version reviewed; sending another amendment clears stale previews. Pending private reviews block final approval.
- Detected safety concerns stop negotiation, clear pending plans and approvals, and receive a supportive private response. The shared channel gets only a generic stop notice, never the private trigger. Retry cannot restart a safety-stopped room. Detection combines a conservative local pattern check with a validated model flag; it is not a guarantee of detecting every unsafe message. Humor defaults off and is only permitted by the prompt when explicitly requested and appropriate.

`npm run check` tests these rules using scripted agents in place of Gemini, so it needs no API key.

## Scope and limits

- Three roommates; availability is typed in by hand. Supports bathroom cleaning, chores, dishes, noise, guests, bills and academic schedule conflicts. Model-generated plans remain suggestions for human review. Existing bathroom-specific UI labels are preserved as requested.
- Reminders only fire while a student has the page open (in-app banner plus browser notification). There's no push or SMS yet.
- Links are bearer tokens. Anyone holding a seat link can act as that roommate.
- The demo view puts all three private chats on one page, as tabs. It exists only for demo rooms with fictional data. Real rooms have no demo link.

## Track 3 demo and verification

1. Start the demo and send the first suggested line in Max's private chat. He cannot clean Thursday because of an assignment due at 11 PM and offers Jordan's Saturday turn by noon.
2. Return to Max's tab and review the sharing preview. The assignment reason starts unchecked. Check it explicitly if the group should discuss the academic conflict; otherwise share only availability and the swap offer. Complaints can remain private.
3. Send Jordan's first suggestion and approve the specific preview: Jordan can cover Thursday before 6 PM in return for Saturday. Send and review Sam's first suggestion: Sam keeps Tuesday before 6 PM.
4. Open **Agent negotiation**. Read the neutral summary, separated facts and assumptions, conflicts and options. The recommended swap covers toilet, sink and tub, with an assignee and deadline for each turn.
5. Open each roommate's existing agreement card. Approve the same version as Max, then Jordan: it must still be a draft. Sam's approval confirms it. To test revisions, use **Request a change**, review and send the preview; all three must approve the new version.

Checks (from this directory):

```powershell
npm run check
npm run typecheck
npm run build
# With npm run dev running in another terminal and GEMINI_API_KEY configured:
npx tsx scripts/check-demo.mts
```

`check-rules.mts` uses scripted agents and temporary storage to test privacy, versioning, pauses, safety stops and concurrency. `check-demo.mts` creates a fictional demo through the real HTTP routes, uses live Gemini responses, explicitly shares the assignment reason, and checks summary/options, the swap and three-person confirmation. It writes a demo room to the running server's prototype store and makes Gemini API calls. Set `ROOMPEACE_TEST_URL` to test a different local port. Neither check automates browser clicks or verifies pixel appearance.
