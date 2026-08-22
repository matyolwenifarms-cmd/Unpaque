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

---

## 6. The three features are named Unpack, Research and Detect

**The spec says.** §0 and §1 of *The Detective — Master System Build* name the
platform's three surfaces "Unpack", "The Researcher" and "The Detective".

**What is built.** The tabs, headings and navigation read **Unpack**,
**Research** and **Detect**.

**Why.** Only one of the three could carry a person. "Unpack" is an imperative
and refuses to become "The Unpacker" — the platform is named after it, and
renaming the feature to match its two siblings would rename the product. That
leaves one verb sitting beside two characters, and a tab bar mixing the forms
reads as three unrelated products bolted together rather than one tool used
three ways. Made parallel the other way, all three become instructions to the
reader about what they are here to do, which is what a tab is for.

The names give up a noun, and the plate gives it back: each feature carries a
one-word category beneath it — *diagnostics*, *literature*, *investigations* —
so "Detect" is never the only thing on screen telling somebody what the tool
does.

**What did not change, and deliberately.**

- **The routes.** `/cases` and `/cases/:id` still name what is there: a list of
  cases, and a case. `/detect/:id` would mean "a detect", which is not a thing.
  A tab whose label and path differ is ordinary (GitHub's *Pull requests* is at
  `/pulls`); a path that names nothing is not.
- **The module directories** — `_shared/research/`, `_shared/detective/` — and
  the comments citing the specification by its own names. A comment reworded to
  dodge the term would misquote the document it exists to point at. This file's
  own headings cite spec sections and keep the spec's names for the same
  reason.
- **The section headings in `ARCHITECTURE_ASSESSMENT.md`**, which is an
  assessment dated to what it assessed. Rewriting a record in place stops it
  being a record.
