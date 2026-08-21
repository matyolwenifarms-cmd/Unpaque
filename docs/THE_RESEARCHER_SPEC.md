# UNPAQUE — THE RESEARCHER
Master Build Specification | Academic Research Support Feature

**VERSION 0.1 • DRAFTED 21 AUGUST 2026**

Working proposition: *the study is the researcher's work. The administration is not.*

---

## 0. MASTER INSTRUCTION

You are implementing THE RESEARCHER as a feature inside the existing UNPAQUE
platform, alongside Unpack (communication diagnostics) and The Detective
(investigative intelligence). Reuse UNPAQUE's authentication, accounts,
navigation, design tokens, storage, billing, job queue and AI provider
abstraction. Do not duplicate a platform capability because this feature needs
one.

Read `ARCHITECTURE_ASSESSMENT.md` before writing code. It records the stack, the
shared primitives, and the mechanism §4 below extends.

**The non-negotiable architectural rule.** Do not build this as CHAT UI +
SEARCH API + LLM. Build it as: PROPOSAL ENGINE + LITERATURE ENGINE +
BIBLIOGRAPHIC PROVIDER LAYER + PASSAGE ENGINE + DESIGN ENGINE + DATA ENGINE +
TRANSCRIPTION ENGINE + ANALYSIS ENGINE + REPORT ENGINE + INTEGRITY ENGINE. The
conversational surface is one control over that system, not the system.

**Implement vertically.** Data model → service → API → state → UI → tests, for
each capability. Mock data is acceptable for demonstration; component contracts
must match the eventual real contracts.

---

## 1. PRODUCT DEFINITION

The Researcher supports a researcher from proposal through to report: finding
and verifying literature, designing a study, collecting and transcribing data,
analysing it within a declared paradigm, and drafting the write-up.

It does not conduct the research, does not grant ethics clearance, does not
decide what the findings mean, and does not produce submittable work under its
own authority. Its purpose is to remove administrative load so the researcher
spends their time on the study.

**What success means.** The researcher finishes sooner *and can show their
working* — every reference resolves, every quotation is locatable in the source,
every analytic claim names the paradigm it was made under, and every
machine-drafted passage is marked as such.

---

## 2. THE RESEARCHER CONSTITUTION

Implement these as system rules, not merely prompt text.

- A reference that cannot be resolved does not exist.
- A quotation that cannot be located in a retrieved source is not a quotation.
- Method must be coherent with the paradigm it claims.
- A finding is bounded by the design that produced it.
- Correlation is not causation, and a significance test is not a finding.
- Absence of significance is not evidence of absence.
- Sample size and effect size travel with every statistical claim.
- The researcher's hypothesis is a hypothesis.
- Machine-drafted text is marked, always, and the mark survives export.
- Unknown is a legitimate answer.
- Ethics clearance is a human institutional decision. The system records it; it
  never issues it.

---

## 3. THE INTEGRITY MODEL

Every reference, quotation and analytic claim carries a status. Nothing reaches
a screen without one.

| Status | Meaning | Required behaviour |
|---|---|---|
| `VERIFIED` | Identifier resolved against a provider this session. | May display in full, with link. |
| `PROVIDER_ONLY` | Returned by a provider; identifier not yet re-resolved. | Display, marked unverified. |
| `FULL_TEXT` | Open-access full text retrieved and stored. | Passage extraction permitted. |
| `METADATA_ONLY` | No retrievable full text. | Reference lists; **no passage may be shown**. |
| `UNRESOLVABLE` | Identifier did not resolve. | Never displayed. Counted and reported. |
| `USER_SUPPLIED` | The researcher added it by hand. | Marked as unverified by the system. |
| `RETRACTED` | Provider reports a retraction or expression of concern. | Displayed with a prominent notice. |

`RETRACTED` is not optional. Crossref and OpenAlex both expose retraction
status, and a literature review that cites a retracted paper without knowing is
the specific harm this feature exists to prevent.

---

## 4. THE BIBLIOGRAPHIC PROVIDER LAYER

**This is the section that decides whether the feature is usable or a liability.**

A language model asked for references will invent them: plausible authors,
plausible titles, plausible years, DOIs that do not resolve. This is the best
documented failure mode of the technology. In a tool for academics it is not a
defect to be tidied later — a fabricated citation in a submitted literature
review is a research-integrity finding against the user.

It cannot be fixed by prompting. It is designed out.

### The rule

**The model never supplies a reference.** It may decompose a research question
into search strategies, rank provider results for relevance, cluster them
thematically, and *explain* why a result bears on the study. It may not emit a
citation, a DOI, an author list, a year or a title. Those fields are populated
only from a provider response.

Enforce it structurally, in this order:

1. **The reference type has no model-writable constructor.** A `Reference` is
   created by the provider layer or not at all. The analysis model's tool schema
   accepts a `reference_id` drawn from an enum of ids already retrieved this
   session — so a citation of something not retrieved is a malformed tool call,
   not a mistake to catch downstream. This is the same mechanism Unpack uses for
   framework attribution; see `_shared/diagnostic/report.ts`.
2. **A verification pass before display.** Every identifier is re-resolved. An
   unresolvable one is dropped and counted, never rendered.
3. **A guard over generated prose**, extending `_shared/diagnostic/guard.ts`,
   refusing any generated text containing a DOI-shaped or citation-shaped string
   that does not correspond to a retrieved reference.

### Providers

Implement independently behind one interface, so a provider can be added
without touching the application.

| Provider | Covers | Notes |
|---|---|---|
| OpenAlex | ~250M works, all disciplines | No key required. Good default. Exposes retraction status. |
| Crossref | DOI metadata of record | Authoritative for DOI resolution. |
| Semantic Scholar | Abstracts, citation graph, some OA PDFs | Rate-limited without a key. |
| Europe PMC | Biomedical, many OA full texts | Section-level XML — the best full-text source where it applies. |
| CORE | Aggregated OA full texts | Where Europe PMC does not apply. |
| arXiv | Preprints | **Must be labelled as not peer reviewed.** |
| DOAJ | Open-access journal verification | Useful for flagging predatory venues. |

A preprint displayed without a "not peer reviewed" label is a defect, not a
styling choice.

### Ordering

The requirement is newest-to-oldest. Default to that, and make it switchable to
relevance and to citation count — a 1967 Kelley paper is not less relevant to an
attribution study for being old, and a review ordered purely by recency buries
the foundational work every examiner will expect to see.

---

## 5. THE PASSAGE ENGINE

The requirement: hover a reference and see a short passage showing its
relevance; click and land on that passage in the paper.

### How it must work

- A passage exists only where status is `FULL_TEXT`. There is no other path.
- Full text is retrieved from an open-access source, normalised, and stored with
  the character offsets preserved.
- The model selects a span **by offset**, not by writing text. It returns
  `{reference_id, start, end, why}`. The passage displayed is the substring at
  those offsets — so the quotation is a *slice of the source*, and a
  hallucinated quotation is not expressible.
- `why` is generated prose explaining relevance to this study, and is guarded.
- The deep link carries the offset. For a stored PDF, resolve the offset to a
  page and highlight rectangle at retrieval time and cache it.
- **`METADATA_ONLY` shows no passage** and says why: "full text not openly
  available — the reference is listed, the passage is not."

That last behaviour will be the most tempting thing in the product to quietly
soften. It is the difference between a tool an examiner can trust and one that
produces confident quotations from papers nobody retrieved.

---

## 6. PARADIGM AND METHOD

### A closed vocabulary

The paradigms and analytic theories are a **closed enum**, in the same sense as
Unpack's eight frameworks. Every analytic claim names one. An analysis that
cannot name its paradigm does not render.

**Paradigms** (15): positivism, post-positivism, interpretivism, constructivism,
pragmatism, critical theory, feminist theory, symbolic interactionism,
phenomenology, grounded theory, hermeneutics, critical realism, postmodernism,
social constructionism, realism.

**Analytic theories** (14): grounded theory, phenomenology, symbolic
interactionism, social constructionism, discourse theory, critical discourse
theory, narrative theory, actor-network theory, structuration theory,
institutional theory, diffusion of innovations, technology acceptance,
social learning theory, theory of planned behaviour.

Each carries: name, tradition with a citable source, plain-language gloss,
compatible methods, characteristic data types, and characteristic analytic
moves. The gloss is what a first-year student reads; the tradition is what a
supervisor checks.

### Coherence checking

The system must flag — never silently correct — an incoherent design:

- A positivist frame with an interpretive method, or the reverse.
- Grounded theory declared alongside a fixed a-priori coding frame.
- Phenomenology declared with a sample sized for statistical inference.
- A causal research question with a purely correlational design.
- Thematic saturation claimed without an account of how it was judged.

Present these as a supervisor would: name the tension, cite the methodological
source, and leave the decision with the researcher. Some are defensible;
pragmatism exists precisely to defend some of them.

---

## 7. LIFECYCLE

```
PROPOSAL → DESIGN → INSTRUMENTS → COLLECTION → TRANSCRIPTION
        → ANALYSIS → INTERPRETATION → WRITE-UP → EXPORT
```

Each stage reads the previous stage's artefacts. A proposal that declares a
paradigm constrains the instruments offered; instruments constrain the analyses
offered; analyses constrain the claims the write-up may make. **The chain is the
product** — it is what makes the write-up defensible rather than merely fluent.

### Proposal

Upload or draft. Extract: research question, sub-questions, paradigm, design,
population, sampling strategy, instruments, analysis plan, ethics status. Each
extracted field is editable and marked as extracted-not-confirmed until the
researcher confirms it.

Then run the literature engine (§4) against the question, and the coherence
checks (§6) against the design.

### Collection and transcription

- Audio and video upload; interviews, focus groups, field recordings.
- Diarised transcription with speaker labels and timestamps.
- **Every transcript segment keeps its timecode**, so a quotation in the final
  report resolves to the second of audio it came from. Same discipline as §5.
- Transcription is a job, not a request — see §10.
- Confidence per segment; low-confidence segments flagged for human review
  rather than silently accepted.

### Analysis

**Qualitative.** Open/axial/selective coding, codebook management, code
co-occurrence, thematic development, constant comparison, memoing. Every code
application links to the exact segment. Themes are assembled *from* codes and
show their constituent extracts — a theme with no extracts does not exist.

**Quantitative.** Descriptives, distributions, cross-tabs, correlation, t-tests,
ANOVA, chi-square, regression, reliability (Cronbach's α, McDonald's ω).

The statistical discipline is the same shape as Unpack's boundary:

- **Assumptions are checked and reported**, never assumed. Normality,
  homogeneity of variance, independence, multicollinearity.
- **No p-value without n and an effect size.** A `p` alone does not render.
- **Confidence intervals accompany estimates.**
- **A correlational design cannot emit a causal claim.** The guard refuses
  "causes", "leads to", "results in" in prose attached to a correlational
  analysis — the design is in the data model, so this is checkable.
- **Multiple comparisons are counted**, and a correction offered when the count
  exceeds one.
- Non-significance is reported as non-significance, never as "no effect".

**Mixed methods.** Only where the declared paradigm supports it — pragmatism
most obviously — with the integration point stated explicitly.

### Write-up

The system drafts. It does not author. Every generated passage is stored with
its provenance: which analysis, which extracts, which references, which model,
when. **The mark survives export** — see §8.

Sections: introduction, literature review, methodology, findings, discussion,
conclusion, references, appendices. Reference lists generate from `VERIFIED`
references only, in a selectable style (APA 7, Harvard, Vancouver, Chicago).

---

## 8. RESEARCH INTEGRITY

The feature's stated purpose is to give the researcher time for the study rather
than the administration. That is legitimate and worth building. It is also one
positioning decision away from a tool that produces work a student submits as
their own.

Requirements:

- **A provenance record per drafted passage**, retained and exportable.
- **A declaration artefact**: a generated statement of what the system did,
  which the researcher can attach to a submission. Most institutions now require
  disclosure of AI assistance; the system should make an accurate disclosure the
  easy path.
- **No copy anywhere may imply submittable work**, or that the output is the
  researcher's own writing, or that use needs no declaration.
- **Institutional policy varies**, and the system does not know a given
  university's rules. It must not assert that a use is permitted.

This is the same discipline as the Academy's refusal to imply accreditation, and
it is enforced the same way: a test over user-facing strings that refuses
"submission-ready", "publication-ready", "undetectable", "your own work", and
"no declaration needed".

---

## 9. ETHICS, POPIA AND HUMAN PARTICIPANTS

Research with human participants is regulated by institutions, and in South
Africa personal information is governed by POPIA.

- **Ethics clearance is recorded, never granted.** Fields: committee, reference
  number, approval date, expiry, conditions. A project without a recorded
  clearance may still be used — many studies do not need one — but the system
  must not describe an unrecorded project as cleared.
- **Interview data is personal information.** Transcripts frequently contain
  *special* personal information under POPIA s26 — health, religion, sexual
  orientation, trade union membership, criminal history, biometrics.
- **Consent records** per participant: what was consented to, when, withdrawal
  status. Withdrawal must be actionable — a participant who withdraws has their
  data excluded from every subsequent analysis and export, and the system says
  what it excluded.
- **De-identification support**: detect and pseudonymise names, places,
  employers and contact details in transcripts, with a reversible mapping held
  separately and access-controlled.
- **Retention and deletion** per project, with a default and an audit trail.
- **Cross-border processing** is a POPIA consideration; record where data and
  model processing occur.

Where a recording contains a person's voice or face, that is biometric-adjacent
information; treat consent for it as explicit and separate, as the Academy does
for invigilation stills.

---

## 10. JOBS, PROVIDERS AND MODELS

Transcription, full-text retrieval, OCR, large-corpus literature search and
report assembly all exceed an Edge Function's wall-clock ceiling. They are
**jobs**: a row, a worker, a visible state, a retry bound, and a dead-letter
path. See `ARCHITECTURE_ASSESSMENT.md` §3.

Show real progress from real state — retrieving, extracting, transcribing,
coding — never a spinner standing in for work whose state you have.

All model and provider access sits behind the platform's abstraction (Detective
spec §23). The Anthropic API is the reference implementation for language,
reasoning and vision.

---

## 11. HARD PROHIBITIONS

- Never emit a reference the model produced rather than a provider returned.
- Never display a quotation not sliced from retrieved full text.
- Never display an unresolvable identifier.
- Never present a preprint without labelling it unreviewed.
- Never present a retracted work without its retraction.
- Never emit a causal claim from a correlational design.
- Never report a p-value without n and an effect size.
- Never describe a project as ethically cleared without a recorded clearance.
- Never imply the output is submittable, publication-ready or undeclarable.
- Never retain the data of a participant who has withdrawn.

---

## 12. PHASES

**Phase 0 — Foundations.** Domain types, migrations, project privacy and
server-side authorisation before any research data exists. The paradigm and
theory vocabulary as a closed enum with its coherence rules.

**Phase 1 — Literature.** Provider layer, verification, ranking, the reference
list. `METADATA_ONLY` behaviour correct from the first commit. No passages yet.

*In progress.* `_shared/research/` holds:

- the `Reference` contract, constructed only by `fromProvider()` and never by a
  model;
- the **OpenAlex** adapter (search, open-access status, retraction, preprints);
- the **Crossref** adapter (search plus single-DOI `resolve()`);
- the **verification pass**, which re-resolves every DOI before display.

88 tests, 13 of which **skip** until somebody runs `npm run research:record` on
a machine with network access. Until then no adapter has met the real API, and
the suite says so in its own output.

**A departure from §3, argued.** The status table there lists `VERIFIED`,
`FULL_TEXT`, `METADATA_ONLY` and `UNRESOLVABLE` as one set of mutually
exclusive states. Implemented that way it does not survive contact with the
feature: the best case a researcher can have is a reference that is *both*
verified and readable, and a single field forces the verification pass to
overwrite availability in order to record its own result — destroying the one
fact the passage engine depends on. So there are two independent fields,
`verification` and `availability`, with `retracted` a third axis again, and
`leadingCaveat()` decides what a reader is told first.

**Retraction is three-valued, and real data is why.** A recorded OpenAlex
search flagged `is_retracted` on the Lancet Commission's 2020 dementia report —
a standing, heavily cited paper — alongside two genuine retractions that both
announce themselves in their titles. Aggregators get this wrong.

The first design let retraction ratchet upward: any source saying retracted
made it retracted, reasoning that a false positive costs a double-check and a
false negative costs a citation. That is right about one reference and wrong
about the product. A researcher shown a paper they know is fine, labelled
Retracted, learns the labels are unreliable and then disbelieves the true one
further down.

So `confirmed` requires a registration agency, an aggregator alone gets
`contested`, and the caveat reads *"Possibly retracted — sources disagree,
check before citing"*. This is the Detective specification's §4 `CONTESTED`
applied here: show the conflict, do not silently choose a side. The agency can
confirm a retraction and cannot clear one, because a retraction published but
not yet registered is ordinary and silence is not evidence of absence.

Errata are not retractions. Real Crossref records carry `["erratum",
"retraction"]` together, so erratum-only works exist — and marking a corrected
paper as retracted tells a researcher not to cite something perfectly citable.

Still to do: Unpaywall, the retrieval that turns `metadata_only` into
`full_text`, and Phase 2's passage engine.

**Phase 2 — Passages.** Full-text retrieval, offset storage, hover preview,
deep link. This is where the feature becomes the thing that was asked for.

**Phase 3 — Proposal and design.** Extraction, coherence checking, instruments.

**Phase 4 — Collection and transcription.** Upload, jobs, diarisation,
timecodes, consent and de-identification.

**Phase 5 — Qualitative analysis.** Coding, codebook, themes, extract linkage.

**Phase 6 — Quantitative analysis.** Descriptives through regression, with the
assumption and reporting discipline of §7 enforced in the output contract.

**Phase 7 — Write-up and export.** Drafting with provenance, reference styles,
the declaration artefact, export.

Phase 1 and 2 before anything else. A researcher will forgive a missing
analysis module. They will not forgive a reference that does not exist.

---

## 13. TESTING AND ACCEPTANCE

Every suite carries negative controls — a check that cannot fail is not
evidence. Specifically:

- A model response containing a fabricated DOI **must** fail the guard.
- A reference whose identifier does not resolve **must not** render.
- A passage request against a `METADATA_ONLY` reference **must** return no
  passage, and the UI must say why.
- An offset outside the stored full text **must** fail rather than truncate.
- A causal phrase attached to a correlational analysis **must** be refused.
- A `p` without `n` and an effect size **must** fail the output contract.
- A withdrawn participant's data **must** be absent from a re-run analysis and
  from every export format.
- The strings in §8 **must** be refused by the house-style test.

Acceptance: a researcher uploads a real proposal, receives a reference list in
which **every** entry resolves, opens three passages that land on the right text
in the right papers, and exports a draft in which every machine-written
paragraph is marked.

---

## 14. OPEN QUESTIONS FOR THE HUMAN

1. **Disciplinary scope at launch.** Europe PMC gives excellent section-level
   full text for biomedical work and nothing outside it. A social-sciences
   launch leans on CORE and OpenAlex and will have a lower `FULL_TEXT` rate.
   Which discipline is the wedge?
2. **Institutional relationships.** Much of the literature a postgraduate needs
   is paywalled. Without a library link (Shibboleth/OpenAthens, or an
   institutional subscription), `METADATA_ONLY` will be common. Is an
   institutional sales motion part of the plan, or is this an open-access tool?
3. **Language.** The paradigms and the analytic vocabulary are Anglophone. Is
   isiZulu, Afrikaans or Sesotho source material in scope?
4. **Statistical engine.** Implementing inferential statistics correctly is a
   large undertaking. Recommendation: run a real statistical library server-side
   rather than generating numbers with a model.
