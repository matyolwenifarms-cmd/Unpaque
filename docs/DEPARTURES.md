# Departures from the supplied specifications

Deliberate divergences, each argued. Read this before "fixing" something here
that looks wrong against a spec document — it is probably here on purpose.

Nothing in this file is a licence to drift. A departure is recorded when the
specification's model does not survive implementation, and the record exists so
the decision can be overturned by somebody who disagrees rather than
rediscovered by somebody who is confused.

---

## 1. The Researcher §3: one status field becomes three axes

**The spec says.** `VERIFIED`, `FULL_TEXT`, `METADATA_ONLY`, `UNRESOLVABLE`,
`USER_SUPPLIED` and `RETRACTED` are listed together as one set of mutually
exclusive states.

**What is built.** Three independent fields: `verification`, `availability`,
and `retraction`.

**Why.** The best case a researcher can have is a reference that is *both*
verified and readable, and a single field cannot express it. Worse, the
verification pass would have to overwrite `full_text` to record its own result,
destroying the one fact the passage engine depends on. Retraction is a third
axis again: a retracted paper is retracted whatever else is true of it.

`leadingCaveat()` restores a single ordering for display, which is where a
single value was actually wanted.

---

## 2. The Researcher: retraction is three-valued, not a boolean

**The spec implies.** A work is retracted or it is not.

**What is built.** `none` / `contested` / `confirmed`, where only a registration
agency can confirm.

**Why.** A recorded OpenAlex search flagged `is_retracted` on the Lancet
Commission's 2020 dementia report — a standing, heavily cited paper — beside
two genuine retractions that both announce themselves in their titles.
Aggregators get this wrong.

A boolean forces a choice between propagating that false positive and
discarding a flag that is usually right. Someone shown a paper they know is
fine, labelled Retracted, learns the labels are unreliable and then disbelieves
the true one further down. Optimising each label individually degraded all of
them.

This is the Detective's own §4 `CONTESTED` applied one product across: show the
conflict, do not silently choose a side.

---

## 3. The Detective §10: evidence classifications separate three axes

**The spec says.** `PRIMARY`, `CORROBORATING`, `SECONDARY`, `CONTEXTUAL`,
`CLAIM`, `UNVERIFIED`, `DISPUTED`, `CONTRADICTORY`, `UNRESOLVED` — one list.

**What is built.** That list is three questions wearing one coat:

| The spec's value | Actually asks |
|---|---|
| `PRIMARY`, `SECONDARY` | How close is this source to the event? |
| `CORROBORATING`, `CONTRADICTORY`, `CONTEXTUAL` | How does it bear on the claim? |
| `UNVERIFIED`, `DISPUTED`, `UNRESOLVED`, `CLAIM` | What is the epistemic state? |

So proximity lives on the source, as `source_kind` ordered by
`DEFAULT_SOURCE_HIERARCHY`; the relationship lives on the evidence row, as
`evidence_classification`; and the epistemic state lives on the claim, as
`epistemic_status` — which §4 already defines, with the same words.

Kept as one enum, a source could not be both primary and contradictory, which
is an ordinary and important combination. And `UNVERIFIED` would mean two
different things depending on whether it described the evidence or the claim.

**This is the same mistake as §1 above**, in a different document, which is
some evidence that it is a real pattern rather than a preference: a list that
reads naturally in prose is not always a type.

---

## 4. The Detective §9: an inaccurate account is named, not omitted

**The spec says.** `NOT: "The person lied." INSTEAD: Possible explanations +
additional evidence needed to distinguish them.`

**What is built.** Exactly that — and the explanation list *includes* "the
account is inaccurate", positioned among the others rather than first.

**Why this is not a departure from the intent.** The instruction forbids
concluding deception, and the system never does. But offering five explanations
while silently omitting the sixth steers a reader as surely as leading with it:
they can see the gap, and a tool that visibly will not say the obvious thing
loses their trust for everything else it says.

So it is listed, phrased as inaccuracy rather than deceit, never first, and
carries what would distinguish it — like every other explanation. There is a
test asserting it is present and a test asserting it is not first, because both
halves are load-bearing.

---

## 5. Platform: Vite and Supabase, not Next.js

**The spec says.** §0's greenfield addendum suggests a TypeScript full-stack
framework, naming Next.js, and instructs that the assumption be flagged.

**What is built.** Vite + React + Supabase. Argued in
`ARCHITECTURE_ASSESSMENT.md` §3, which is the flag the addendum asked for.
