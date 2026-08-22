# Unpack — how a report is presented

**Read from screenshots of the deployed unpaque.com, 22 August 2026.** This
records the target presentation before it is built, because the running site is
the specification for this and screenshots are not a durable one.

The user's instruction: *"make sure this is how analysis will look like in
Basic Mode"*, with Advanced still to be supplied.

---

## 1. What is on the entry screen

Vertically, centred, on the charcoal ground:

1. The wordmark, amber `Un` and off-white `paque`, with a short amber rule
   beneath the `pa`, then `COMMUNICATION DIAGNOSTICS` in widely tracked
   capitals. **This already matches** what is built.
2. **Three mode tabs** — `Decode`, `Draft`, `New Entry`. Active is a filled
   amber pill with dark text; inactive is plain text.
3. **A depth switch** beneath them — `Basic / Advanced`, separated by a slash.
   Active is bright, inactive is muted. Not a pill.
4. **An explainer paragraph** that defines all five words in one breath:
   Decode analyses an existing message; Draft also rewrites it more clearly;
   Basic is accessible, Advanced is more precise and opens deeper diagnostics;
   New Entry clears everything.
5. **A large textarea**, resizable, placeholder *"Paste the communication here,
   or attach a screenshot below…"*
6. **An attachment row** — `OR ATTACH SCREENSHOTS (0/6): .PNG, .JPG, .WEBP,
   .HEIC` with a `+ Add image` button on the right.
7. **The action button**, an amber pill named for the active mode (`Decode`).
8. **Three cross-links**, each a sentence ending in an amber link with a `→`:
   upload a longer document, run a batch, open Researcher.
9. **A worked example**, headed `A WORKED EXAMPLE` in tracked capitals with the
   line *"This is what Advanced mode returns. No sign in needed to read it."*

Notable: the worked example is on the front page, unauthenticated. Somebody can
see exactly what they would get before typing anything.

## 2. How a report is laid out

Three cards, stacked, each with a tracked-capitals label in the top left.

### `INPUT`
The submitted text, verbatim, unstyled.

### `ANNOTATED SOURCE`
The same text again, flowing as prose, with the diagnosed spans **highlighted
inline** — a warm translucent background on the span — each followed
immediately by a small muted parenthetical naming the device:

> Following a review of current operating conditions, `a decision has been
> made` *(agentless framing)* to consolidate several roles. `Regrettably`
> *(sentiment softener)*, `a number of positions will be impacted`
> *(nominalization)*. We remain `deeply committed to our people` *(value
> claim)*, and affected colleagues will be contacted `in due course`
> *(strategic vagueness)* with further information.

This is the load-bearing difference from what is built. The present report is
four thematic sections each holding findings that carry quotes. The site
presents **one pass over the source text in its own order**, with the analysis
attached to positions in it.

### The verdict card
Opens with **one amber sentence in a heading weight**, naming what the message
does:

> *This message announces job losses while removing any named person from the
> decision that caused them.*

Then, for each annotated span in the order it appears: the span as a small
amber-tinted chip, and beneath it a paragraph of explanation. From the example:
`a decision has been made`, `a number of positions will be impacted`,
`regrettably`, `deeply committed to our people`, `in due course`.

The explanations are two to four sentences, describe the mechanism rather than
condemn, and repeatedly name what the reader is left without — *"the reader
learns what happened but not who is answerable for it"*, *"leaving the reader
without a point to plan around"*.

## 3. The device vocabulary seen so far

Five, from one example, so this is certainly partial:
agentless framing · sentiment softener · nominalization · value claim ·
strategic vagueness

These are **devices**, at a finer grain than the eight communication frameworks
`_shared/diagnostic/frameworks.ts` holds. A device is what is on the page; a
framework is what licenses the reading. They are not alternatives — a device
label should cite a framework — but the existing enum cannot express the device
layer, so it needs one.

Note the spelling: `nominalization`, with a z, against the repository's British
prose. Worth confirming which is intended before it is copied into an enum.

## 4. What this means for what is built

| Built now | The site |
|---|---|
| Four fixed sections (`act`, `responsibility`, `framing`, `ambiguity`) | One annotated pass over the source, in the source's order |
| Findings grouped by theme, each with quotes | Findings anchored to spans, each with a device label |
| No verdict line | One sentence at the top of the verdict card |
| One depth | `Basic` / `Advanced` |
| Decode only | `Decode` / `Draft` / `New Entry` |
| Eight frameworks | Frameworks **plus** a device vocabulary |
| No attachments | Up to six screenshots, four image formats |

The span anchoring is the piece with real engineering consequence. Highlighting
a span in place means the model must return **offsets into the submitted text**,
not copies of it — which is the mechanism the passage engine already uses for
full text, and for the same reason: a returned copy can differ from the source
by a word and nobody will notice. `report.ts` currently takes `quotes: string[]`,
which cannot say *where*.

## 5. Register: what Basic and Advanced actually change

**The layout does not change between them. The vocabulary does.**

The worked example on the front page is labelled Advanced, and its register is
academic throughout — not decorated with jargon, but using the technical term
where it is the accurate one:

- **Speech-act vocabulary, unglossed.** *"The core act is an announcement of
  layoffs, with a secondary act of reassurance."* Core act and secondary act
  are Austin and Searle's terms and are used without explanation.
- **Named grammatical mechanisms.** *"The passive construction reports the
  outcome without naming who chose it."* *"Converting the action into a noun
  removes both the actor and the specific event."*
- **Device labels that are terms of art**: agentless framing, sentiment
  softener, nominalization, value claim, strategic vagueness. A reader who does
  not know what nominalization is gets no help from the label.

What stays constant even at this register, and is the more important half: the
prose describes a mechanism and never condemns. It says what a construction
does and what it leaves the reader without — *"the reader learns what happened
but not who is answerable for it"*, *"leaving the reader without a point to
plan around"* — and never that the sender is dishonest. That is the same line
`guard.ts` already enforces, and it holds in both registers.

**Basic** is therefore the same analysis said without the terms of art: the
front page describes it as "accessible", against Advanced being "more precise"
and opening "deeper diagnostics". So Basic is not a shorter report — it is the
same finding in plain words, and Advanced additionally shows diagnostics Basic
withholds.

## 6. Still open

- **No Basic example has been seen.** Both sets of screenshots supplied show
  the same Advanced worked example, so the plain-language register is inferred
  from the front page's own description of it rather than read from output.
  A Basic sample of the same input would settle it in one screenshot.
- Which diagnostics Advanced adds that Basic does not show at all — "deeper
  diagnostics" is the site's phrase and its content is unknown.
- Whether Draft's rewrite is a third card or replaces the verdict.
- The full device list.
- Whether the four thematic sections survive underneath the annotation.
- `nominalization` is spelled with a z against the repository's British prose.
  Worth settling before it becomes an enum value.

