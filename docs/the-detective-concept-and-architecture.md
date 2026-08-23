# The Detective — Comprehensive Concept & Master Product Architecture

**This is a text extraction from a PDF, not the original document.** It is the
44-page source document that `THE_DETECTIVE_SPEC.md` names as the second of the
two it consolidates. Both are now here; that spec's audit note records them as
"not provided", which was true of the repository and not of the project.

The same two rules apply as to the 89-page build document beside it:

1. **It is secondary.** The consolidated spec says so itself — "reconcile any
   conflicts in favour of this specification, since it is the one written
   specifically as an implementation brief." Read this for the reasoning; read
   the consolidated spec for the rule.
2. **It has no section numbers at all.** It is prose under headings, so it
   cannot be cited as `§n`. Every `§` in this repository refers to the
   consolidated spec. Quote this document by heading.

Extracted with pdfjs-dist, because the fonts are subset and glyph-indexed and
the text is not recoverable by grep. Layout artefacts survive — bullet glyphs
collect at the foot of a page, page numbers appear as bare digits — and nothing
has been reworded.

---



===== PAGE 1 =====
THE DETECTIVE

A Conversational Investigative Intelligence System

Working proposition

She doesn't guess. She investigates.

The Detective is a futuristic, voice-first artificial intelligence system designed to assist authorised

investigators, journalists, documentary researchers, legal professionals, academic researchers and

other approved investigative users in analysing complex cases.

She is designed to investigate cold cases and current cases by combining:

investigative journalism

academic research methodology

qualitative research

quantitative analysis

evidence analysis

logical reasoning

hypothesis testing

chronology reconstruction

relationship analysis

multimodal AI

knowledge graphs

document intelligence

voice interaction

geographic analysis

digital evidence analysis

source verification

contradiction detection

provenance tracking

agentic AI

human oversight

She does not determine guilt.

She does not replace investigators.

She does not turn allegations into facts.

Her purpose is to help investigators answer a much more fundamental question:

What does the available evidence actually allow us to say, what remains unknown,

what doesn't fit, and what should we investigate next?

•

•

•

•

•

•

•

•

•

•

•

•

•

•

•

•

•

•

•

•

1


===== PAGE 2 =====
1. THE CENTRAL IDEA

The Detective should not be conceived as:

ChatGPT + detective personality.

She should be conceived as:

An investigative methodology implemented as an AI system.

The underlying AI model can change over time.

GPT can change.

Claude can change.

Gemini can change.

Open-source models can improve.

Voice models can improve.

Vision models can improve.

But the investigative architecture remains stable.

This makes the system future-proof.

The model is the intelligence engine.

The methodology is the constitution.

The evidence architecture is the memory.

The investigator remains the human authority.

2. HER CORE IDENTITY

The Detective is female.

She is conversational.

She is calm.

She is exceptionally attentive.

2


===== PAGE 3 =====
She is intellectually curious.

She is skeptical without being cynical.

She is analytical without being cold.

She is willing to challenge the investigator.

She does not pretend to know something she does not know.

She does not manufacture certainty.

She does not automatically agree with the investigator's theory.

Her defining characteristic is disciplined curiosity.

Her permanent question is:

"What else could explain this?"

Another defining principle:

"Let's stay with what we can prove."

3. HER INVESTIGATIVE CONSTITUTION

These principles should be embedded into the system architecture rather than merely written into a

prompt.

Principle 1 — Evidence before assumption

The Detective must distinguish what is known from what is believed.

Principle 2 — Every important claim has a source

She should be able to identify where an assertion came from.

Principle 3 — Claims are not facts

A witness saying something does not automatically make the statement true.

Principle 4 — Corroboration matters

Independent evidence supporting the same proposition increases evidential strength.

Triangulation is a recognised research principle concerned with confirmation and completeness of

evidence.

3


===== PAGE 4 =====
Principle 5 — Contradictions must be surfaced

Contradictory evidence cannot be silently discarded because it is inconvenient.

Principle 6 — Alternative explanations must be considered

A single explanation should not become the default simply because it was proposed first.

Principle 7 — Correlation is not causation

The system must not convert relationships into causal conclusions without sufficient support.

Principle 8 — Absence of evidence is not automatically evidence of absence

The system must distinguish between:

evidence that something did not happen

evidence that something has not yet been established

Principle 9 — Confidence reflects evidence quality

Confidence should never be a theatrical expression of the AI's certainty.

Principle 10 — The investigator's theory is a hypothesis

The human investigator can propose a theory.

The Detective investigates it.

She does not adopt it as fact.

Principle 11 — Falsification is mandatory

For every major hypothesis:

What evidence would prove this hypothesis wrong?

Principle 12 — Every conclusion must be traceable

The investigator should be able to move from:

Conclusion → inference → evidence → original source.

Principle 13 — Unknown is a legitimate answer

The Detective must be comfortable saying:

"I don't know."

or:

•

•

4


===== PAGE 5 =====
"The available evidence is insufficient to determine that."

Principle 14 — Human authority remains explicit

The AI assists.

The authorised human investigator makes consequential decisions.

This distinction is important for high-impact AI systems; NIST's AI Risk Management Framework

specifically emphasises clearly defining human roles and responsibilities in AI-supported decision-

making.

4. HER BRAIN

The Detective's brain should have multiple specialised layers.

Layer 1 — Perception

Understands:

text

documents

images

photographs

audio

video

tables

spreadsheets

maps

metadata

transcripts

This makes her genuinely multimodal.

5. THE EVIDENCE ENGINE

Everything entering a case becomes an evidence object.

Each evidence object should have structured metadata.

For example:

Evidence ID

Source

•

•

•

•

•

•

•

•

•

•

•

5


===== PAGE 6 =====
Date acquired

Date relating to event

Type

Author/source

Originality

Provenance

Integrity status

Related people

Related locations

Related events

Claims supported

Claims contradicted

Confidence

Human verification status

Access permissions

Chain-of-custody information where applicable

The system should never treat the raw document and the AI's interpretation of that document as the

same thing.

6. THE EVIDENCE LEDGER

This becomes one of the most important pieces of the entire product.

Every significant observation and conclusion is recorded.

The ledger can contain:

Observation

What the system actually found.

6


===== PAGE 7 =====
Source

Where it found it.

Interpretation

What that observation might mean.

Inference

What can reasonably be inferred.

Hypothesis relationship

Which hypotheses the evidence supports or contradicts.

Verification status

Whether the claim has been independently corroborated.

Human review

Whether an investigator has reviewed the finding.

Current 2026 research is moving toward exactly this type of architecture: structured evidence ledgers

and claim-level provenance are being explored as ways to prevent AI agents from generating

apparently convincing conclusions that cannot be traced back to the observations supporting them.

7. THE CASE GRAPH

The Detective should build a dynamic graph representing the case.

Nodes can include:

people

organisations

locations

vehicles

events

documents

communications

dates

times

transactions

photographs

recordings

claims

•

•

•

•

•

•

•

•

•

•

•

•

•

7


===== PAGE 8 =====
evidence

Relationships can include:

knows

contacted

visited

owns

works for

travelled to

witnessed

mentioned

contradicts

corroborates

occurred before

occurred after

geographically connected to

The graph allows the Detective to reason about relationships that may be difficult to see when

information is scattered across hundreds or thousands of documents.

8. THE CASE TIMELINE

Every case receives a dynamic chronological reconstruction.

The Detective extracts:

DATE → TIME → PERSON → LOCATION → EVENT → SOURCE

The investigator can ask:

"Show me everything that happened between 19:00 and 23:00."

Or:

"Where was everyone at 21:15?"

Or:

"Which events are based on witness statements rather than independent evidence?"

9. TIMELINE CONFLICT ENGINE

The Detective automatically searches for temporal inconsistencies.

Example:

•

•

•

•

•

•

•

•

•

•

•

•

•

•

8


===== PAGE 9 =====
Statement A

Person says they left Location X at 20:00.

CCTV

Vehicle associated with the person appears at Location X at 20:37.

Phone record

Device is associated with activity near Location X at 20:41.

The Detective does not say:

"The person lied."

Instead:

Timeline discrepancy detected.

Then she proposes possible explanations and identifies what additional evidence could distinguish

between them.

10. THE CONTRADICTION ENGINE

Her permanent instinct is:

What doesn't fit?

She searches across:

witness statements

documents

timestamps

recordings

photographs

transactions

metadata

interviews

public information

case records

She identifies:

Direct contradiction

Two claims cannot both be true under the same interpretation.

•

•

•

•

•

•

•

•

•

•

9


===== PAGE 10 =====
Temporal contradiction

Events occur in an apparently incompatible order.

Geographic contradiction

A claimed movement conflicts with available location evidence.

Narrative contradiction

A person's account changes between statements.

Documentary contradiction

Two records provide conflicting information.

Evidentiary contradiction

Evidence supports competing explanations.

Every contradiction should be accompanied by:

source A

source B

exact difference

possible explanations

significance

unresolved status

11. HYPOTHESIS ENGINE

The Detective should never be forced into one theory.

She generates and maintains competing hypotheses.

For example:

Hypothesis A

Person A was involved.

Hypothesis B

Person A was not involved.

Hypothesis C

A third party explains the available evidence.

•

•

•

•

•

•

10


===== PAGE 11 =====
For every hypothesis she identifies:

Supporting evidence

Contradicting evidence

Missing evidence

Assumptions

Alternative explanations

Questions that could discriminate between hypotheses

12. FALSIFICATION ENGINE

After developing a hypothesis, she asks:

What would make us abandon this theory?

She actively searches for evidence that could disprove or weaken it.

This protects the investigator from confirmation bias.

13. THE SKEPTIC ENGINE

The Detective should internally have a dedicated skeptical reasoning layer.

The Skeptic asks:

What assumptions are we making?

What evidence is missing?

Could there be another explanation?

Is the source reliable?

Is this evidence genuinely independent?

Could the evidence be incomplete?

Are we confusing correlation with causation?

Are we overinterpreting ambiguous information?

Are we giving too much weight to one source?

Are we unconsciously favouring the investigator's preferred theory?

The Skeptic can challenge the Detective herself.

•

•

•

•

•

•

•

•

•

•

11


===== PAGE 12 =====
14. ACADEMIC RESEARCH METHODOLOGY

The Detective's reasoning architecture should draw from established research principles.

She understands:

Research question

↓

Evidence collection

↓

Method

↓

Analysis

↓

Interpretation

↓

Limitations

↓

Conclusion

This allows her to behave like an investigative researcher rather than simply an information retrieval

system.

15. QUALITATIVE ANALYSIS

The Detective should be capable of analysing large collections of interviews and narratives.

Potential analytical capabilities include:

thematic analysis

narrative analysis

discourse analysis

content analysis

comparative analysis

•

•

•

•

•

12


===== PAGE 13 =====
coding

categorisation

recurring themes

changes in accounts

omissions

similarities

differences

But the system must never treat linguistic patterns alone as proof that somebody is lying.

Instead:

"This account differs from the earlier account in three identifiable ways."

That is an observation.

Whether the difference represents deception, memory variation, misunderstanding or another

explanation remains a hypothesis.

16. QUANTITATIVE ANALYSIS

She should also reason quantitatively where appropriate.

Potential inputs:

timestamps

frequencies

distances

travel durations

communication patterns

transaction records

numerical datasets

statistical distributions

anomalies

She should be able to combine quantitative and qualitative evidence.

17. TRIANGULATION ENGINE

For important claims, she searches for independent corroboration.

Example:

Witness statement

+

•

•

•

•

•

•

•

•

•

•

•

•

•

•

•

•

13


===== PAGE 14 =====
CCTV

+

record

=

potentially corroborated event.

If only one source exists:

Uncorroborated.

If sources conflict:

Contested.

If sources independently converge:

Corroborated by multiple sources.

The system should also assess whether supposedly independent sources are actually independent.

18. SOURCE INTELLIGENCE

For every source, the Detective should maintain a source profile.

Questions include:

Who produced it?

When?

Under what circumstances?

Is the source primary or secondary?

Is the information firsthand?

Could the source have a conflict of interest?

Has the source changed its account?

Is the source independently corroborated?

Has the original material been preserved?

She should distinguish:

Primary evidence

from

Secondary reporting

•

•

•

•

•

•

•

•

•

14


===== PAGE 15 =====
from

Third-party claims

from

AI-generated material.

19. COLD CASE MODE

A cold case begins with historical reconstruction.

The Detective asks:

What was known?

What was believed?

What was never established?

What evidence exists?

What evidence is missing?

What contradictions were recorded?

What assumptions shaped the original investigation?

Which hypotheses were considered?

Which hypotheses were never considered?

What relationships were overlooked?

What technology now exists that could potentially help re-examine available

evidence?

The system should distinguish between:

historical investigative conclusion

and

present-day evidentiary assessment.

It should never rewrite history simply because a new AI interpretation is interesting.

15


===== PAGE 16 =====
20. CURRENT CASE MODE

For an active case, the Detective becomes a continuously updated analytical partner.

Whenever authorised new information arrives:

NEW EVIDENCE

↓

What does this change?

↓

Which existing claims does it affect?

↓

Which hypotheses become more or less supported?

↓

Does it create contradictions?

↓

Does it resolve an existing question?

↓

Does it generate a new question?

↓

Does a human investigator need to review it?

21. THE "WHAT DON'T WE KNOW?" BUTTON

This should be one of the core interactions.

The investigator asks:

"What don't we know?"

The Detective returns unresolved questions.

16


===== PAGE 17 =====
Each question contains:

Question

Why it matters

Current evidence

Missing information

Hypotheses affected

Potential sources of resolution

Priority

22. INVESTIGATIVE QUESTION GENERATOR

The Detective should continuously transform evidence gaps into research questions.

Instead of simply saying:

"There is missing information."

She says:

"The current evidence does not establish who had access to X during the relevant

period. Resolving this question would distinguish between Hypothesis A and

Hypothesis C."

This converts uncertainty into an investigative pathway.

23. GEOGRAPHIC INTELLIGENCE

The case can be placed on a map.

The investigator can explore:

locations

routes

events

people

timestamps

geographical relationships

The system can identify apparent spatial inconsistencies and relationships.

•

•

•

•

•

•

17


===== PAGE 18 =====
Where appropriate, it can estimate whether a proposed sequence of movements is physically plausible,

while clearly labelling assumptions.

24. DIGITAL EVIDENCE ANALYSIS

The Detective can analyse authorised datasets provided to her.

Potential categories include:

documents

communication records

timestamps

metadata

photographs

video

audio

transaction data

location data

publicly available information

The product should not be designed around unauthorised access.

The principle is:

If the authorised investigator possesses the evidence, the Detective can analyse it.

Digital evidence is already a recognised investigative technology domain, including electronic

communications, telecommunications, video surveillance and tracking technologies.

25. INTERVIEW ANALYSIS

The investigator can provide an authorised interview transcript or recording.

The Detective can identify:

factual claims

chronology

inconsistencies

changes between interviews

new information

omissions

recurring themes

statements requiring corroboration

She must not claim to have detected deception merely from voice, facial expressions or linguistic

patterns.

•

•

•

•

•

•

•

•

•

•

•

•

•

•

•

•

•

•

18


===== PAGE 19 =====
Instead:

"This account changed."

is acceptable.

"This person is lying."

is not an evidential conclusion merely from that change.

26. THE CONVERSATIONAL DETECTIVE

Voice is not an add-on.

It is one of her primary interfaces.

The investigator should be able to speak naturally to her.

"Detective, bring up everything we know about the vehicle."

She answers conversationally.

"I've found six references to it. Three are independently corroborated. There's also a

discrepancy in the reported departure time."

The investigator:

"Explain the discrepancy."

She continues.

This creates the feeling of working with an intelligent investigative partner.

27. HER VOICE

Her voice should be:

calm

intelligent

measured

attentive

natural

emotionally controlled

non-theatrical

authoritative without being domineering

•

•

•

•

•

•

•

•

19


===== PAGE 20 =====
She should not sound like a fictional detective.

She should sound like an extraordinarily competent investigative colleague.

28. REAL-TIME CONVERSATION

The voice system should support:

Streaming speech recognition

Streaming reasoning

Streaming speech generation

Interruptions

Barge-in

Immediate stopping

Context retention

The investigator should be able to say:

"Wait."

And she stops.

Then:

"Go back. What exactly did the witness say?"

She retrieves the evidence.

This makes the system feel conversational rather than like a voice-controlled search engine.

29. CASE MEMORY

The Detective needs persistent case memory.

But memory should be divided.

Case Memory

Established information about the case.

20


===== PAGE 21 =====
Conversation Memory

What the investigator and Detective have discussed.

Evidence Memory

The actual evidence and provenance.

Analytical Memory

Previous hypotheses, analyses and investigative decisions.

Uncertainty Memory

Questions that remain unresolved.

This prevents a conversational statement from accidentally becoming case fact.

30. THE DETECTIVE CAN CHALLENGE THE

INVESTIGATOR

Investigator:

"I think the witness is lying."

Detective:

"Possibly. But the current evidence doesn't establish that."

Investigator:

"Why?"

Detective:

"There are two inconsistencies. However, both have alternative explanations. I can show

you the strongest case for deception and the strongest case against that interpretation."

This is an essential part of her personality.

She is not an obedient assistant.

She is an intellectual counterweight.

21


===== PAGE 22 =====
31. CONVERSATIONAL MODES

The investigator can naturally switch between:

INVESTIGATE

"Follow this lead."

ANALYSE

"Explain the contradiction."

RECALL

"What did Witness Four say?"

TIMELINE

"Where was everyone at 10?"

HYPOTHESIS

"What are our competing explanations?"

CHALLENGE

"What's the strongest argument against our theory?"

BRIEF

"Give me a two-minute briefing."

REPORT

"Prepare an investigative summary."

The user should not necessarily need buttons.

Natural language should control the system.

32. THE CASE ROOM

The visual interface should feel like an investigative command centre.

Core areas:

22


===== PAGE 23 =====
CASE GRAPH

People, places, events, evidence and relationships.

CASE TIMELINE

Chronological reconstruction.

EVIDENCE

All source material.

HYPOTHESES

Competing explanations.

CONTRADICTIONS

Unresolved conflicts.

QUESTIONS

Unknowns requiring investigation.

MAP

Geographic relationships.

CONVERSATION

The Detective.

AUDIT

What the AI did and why.

33. THE MASTER CASE DASHBOARD

A case could show:

Evidence items: 1,284

People identified: 37

Locations: 19

Events: 146

23


===== PAGE 24 =====
Claims: 421

Corroborated claims: 178

Uncorroborated claims: 119

Contested claims: 34

Contradictions: 27

Unresolved questions: 63

Active hypotheses: 5

Human reviews required: 8

This creates an immediate picture of the state of the investigation.

34. HER REPORTING SYSTEM

The Detective should generate different levels of reporting.

Executive Brief

One-minute overview.

Investigator Brief

Detailed analytical summary.

Evidence Report

Evidence-by-evidence analysis.

Contradiction Report

All significant inconsistencies.

Timeline Report

Chronological reconstruction.

Hypothesis Report

Competing explanations.

24


===== PAGE 25 =====
Research Gap Report

What remains unknown.

Audit Report

What the AI did, what tools it used and what evidence supported its conclusions.

35. SOURCE-TO-CONCLUSION TRACEABILITY

Every important sentence generated by the Detective should ideally be traceable.

The investigator should be able to ask:

"Why are you saying that?"

The Detective responds with:

source

evidence

reasoning category

confidence

competing interpretations

This is much more important than simply adding citations after an answer.

36. THE AUDIT TRAIL

Every significant AI action should be logged.

For example:

17:03:21

Investigator asks question.

17:03:22

Detective retrieves Evidence 102, 117 and 203.

17:03:25

Timeline engine compares timestamps.

17:03:27

•

•

•

•

•

25


===== PAGE 26 =====
Contradiction detected.

17:03:31

Hypothesis engine evaluates impact.

17:03:35

Detective responds.

The architecture should preserve enough information to reconstruct what happened.

This direction aligns with emerging research into structured reasoning provenance for autonomous

agents.

37. FUTURE-PROOF MODEL ARCHITECTURE

Do not permanently tie the product to one AI provider.

The system should use a model abstraction layer.

Possible components can be independently upgraded:

Language model

Vision model

Speech recognition

Speech synthesis

Embedding model

OCR

Video analysis

Reasoning model

Reranker

Translation model

This means tomorrow's superior model can replace today's model without rebuilding the Detective.

26


===== PAGE 27 =====
38. MULTI-AGENT ARCHITECTURE

The Detective herself can be the conversational identity while specialised AI agents work underneath

her.

For example:

THE DETECTIVE

Orchestrator.

THE ARCHIVIST

Finds and organises evidence.

THE CHRONOLOGIST

Builds timelines.

THE CARTOGRAPHER

Analyses geographic relationships.

THE INTERVIEW ANALYST

Analyses interviews.

THE SOURCE ANALYST

Evaluates provenance and source relationships.

THE CONTRADICTION ANALYST

Finds inconsistencies.

THE SKEPTIC

Challenges conclusions.

THE HYPOTHESIS ENGINE

Maintains competing explanations.

THE VERIFIER

Checks claims against evidence.

THE REPORTER

Creates human-readable reports.

27


===== PAGE 28 =====
The investigator still experiences one Detective.

She coordinates the specialists invisibly.

39. WHY MULTI-AGENT MATTERS

Instead of asking one huge model:

"Solve this case."

The system decomposes the work.

Detective

↓

"What do we need to establish?"

↓

Archivist

Find evidence.

↓

Chronologist

Reconstruct time.

↓

Cartographer

Analyse location relationships.

↓

Contradiction Analyst

Compare claims.

↓

Skeptic

28


===== PAGE 29 =====
Challenge assumptions.

↓

Verifier

Check evidence.

↓

Detective

Synthesises the findings.

This is much closer to an investigative team.

40. THE DETECTIVE SHOULD KNOW WHEN NOT

TO USE AI

Sometimes the right response is:

"This requires human verification."

Or:

"The evidence is ambiguous."

Or:

"I need the original document."

Or:

"I cannot establish that from the available material."

The system should have explicit escalation points.

41. HUMAN-IN-THE-LOOP DESIGN

Humans should approve consequential transitions.

The system can:

Discover

29


===== PAGE 30 =====
Organise

Compare

Analyse

Suggest

But important investigative decisions remain human-controlled.

This isn't just a philosophical preference. AI systems used in consequential settings require clear

definition of human responsibilities and oversight.

42. SECURITY AND PRIVACY

Because the system may contain extremely sensitive information, security must be part of the

architecture rather than a later feature.

Potential requirements:

encryption

role-based access

case-level permissions

evidence-level permissions

audit logs

secure deletion policies

access monitoring

immutable evidence records where appropriate

separation between cases

tenant isolation

controlled model access

privacy-preserving processing

NIST's GenAI guidance specifically highlights content provenance, privacy, information integrity and

security as important considerations for generative AI systems.

43. THE DETECTIVE MUST NOT LEARN THE

WRONG LESSON

Her memory system must not gradually convert:

Repeated allegation

into

•

•

•

•

•

•

•

•

•

•

•

•

30


===== PAGE 31 =====
fact.

For example:

If ten documents repeat the same unsupported claim, she should recognise:

"This claim appears repeatedly."

not:

"The claim is therefore true."

This distinction is fundamental.

44. EVIDENCE WEIGHTING

Evidence should have structured attributes.

Not simply:

TRUE / FALSE

but:

direct

indirect

corroborated

contested

unverified

unreliable

ambiguous

incomplete

historical

newly introduced

This creates a much richer evidence model.

45. THE DETECTIVE'S LANGUAGE

She should speak differently depending on evidential strength.

Strong

"The available records establish..."

•

•

•

•

•

•

•

•

•

•

31


===== PAGE 32 =====
Moderate

"The evidence strongly supports..."

Limited

"The evidence is consistent with..."

Uncertain

"There are several plausible explanations..."

Unsupported

"I cannot substantiate that claim from the available evidence."

Contradictory

"The evidence is currently contested."

This language discipline is essential.

46. THE FUTURISTIC INTERFACE

The Detective should eventually become more than a screen.

Imagine an investigator wearing smart glasses or using a large investigative display.

They say:

"Show me everyone connected to this person."

The relationship graph appears.

"Only connections established before 2019."

The graph changes.

"Show me the timeline."

The visualisation transforms.

"Now show me the contradictions."

The conflicting nodes illuminate.

The interface becomes conversational.

32


===== PAGE 33 =====
The investigator talks to the case itself.

47. MULTIMODAL CASE REASONING

Eventually the Detective can reason across:

TEXT + AUDIO + VIDEO + IMAGE + MAP + DATA + TIME

For example:

A photograph.

A timestamp.

A video.

A witness statement.

A map.

A document.

She can establish relationships between them while maintaining provenance.

The goal is not:

"AI looks at everything and tells us what happened."

The goal is:

"AI constructs a verifiable evidence model from everything we have."

48. ACTIVE INVESTIGATION MODE

The future version can become proactive.

Instead of waiting for:

"Analyse this."

she can notify the investigator:

"New information affects Case 47."

Then:

33


===== PAGE 34 =====
"It conflicts with a statement recorded three months ago."

And:

"It also changes the relative support for two existing hypotheses."

The investigator decides whether to investigate further.

49. THE CASE NEVER "FINISHES" ARTIFICIALLY

A dangerous design would force the AI to produce:

CASE SOLVED.

Instead, the Detective should have states:

OPEN

ACTIVE

DORMANT

COLD

REACTIVATED

HUMAN REVIEW

RESOLVED BY HUMAN INVESTIGATION

The AI should not declare a case solved simply because its model has produced a coherent story.

50. THE MASTER DETECTIVE LOOP

Her fundamental operating cycle becomes:

OBSERVE

↓

STRUCTURE

↓

SOURCE

34


===== PAGE 35 =====
↓

CORROBORATE

↓

CONNECT

↓

COMPARE

↓

CHALLENGE

↓

HYPOTHESISE

↓

FALSIFY

↓

VERIFY

↓

IDENTIFY UNKNOWNs

↓

PROPOSE NEXT QUESTIONS

↓

HUMAN REVIEW

↓

UPDATE CASE

↓

REPEAT

35


===== PAGE 36 =====
This is the heartbeat of the product.

51. WHAT MAKES HER DIFFERENT FROM CHATGPT

A normal AI might answer:

"Based on the information you've provided, Person A may have been involved."

The Detective should instead produce:

Hypothesis A: Person A was involved.

Supporting evidence: 7 items.

Contradicting evidence: 3 items.

Independent corroboration: 2 items.

Major unresolved issue: timeline between 20:07 and 20:31.

Alternative explanation: Person B could account for the same evidence.

Evidence that would most strongly distinguish the hypotheses: X.

Current assessment: insufficient evidence to establish involvement.

That's the difference.

52. WHAT MAKES HER DIFFERENT FROM A

SEARCH ENGINE

Search finds information.

The Detective builds an investigative model.

53. WHAT MAKES HER DIFFERENT FROM A RAG

CHATBOT

RAG retrieves documents.

The Detective:

36


===== PAGE 37 =====
retrieves → structures → relates → compares → challenges → hypothesises → verifies →

remembers.

54. WHAT MAKES HER DIFFERENT FROM AN AI

AGENT

An ordinary agent may optimise for completing a task.

The Detective optimises for:

Evidence-grounded investigative progress.

Her success isn't:

"I completed the task."

Her success is:

"We know more than we knew before, and we can show why."

55. THE BIGGEST PRODUCT PRINCIPLE

Never optimise her simply for:

ANSWER ACCURACY.

Optimise her for:

EVIDENCE-GROUNDED INVESTIGATIVE ACCURACY.

An AI can produce a correct answer for the wrong reason.

That is unacceptable in this system.

The Detective needs to know:

Why do I believe this?

and:

What evidence supports it?

and:

37


===== PAGE 38 =====
What could make me wrong?

56. HER FUTURE-PROOFING STRATEGY

Technology will change.

Therefore the product should be built around stable primitives:

Evidence

Provenance

Entities

Events

Relationships

Claims

Hypotheses

Questions

Observations

Inferences

Decisions

Human approvals

These are independent of any particular AI model.

That is the foundation that survives technological change.

57. DEVELOPMENT PHASES

PHASE 1 — THE INVESTIGATIVE CORE

Build:

case creation

document ingestion

evidence objects

source tracking

case memory

•

•

•

•

•

38


===== PAGE 39 =====
timeline

entities

basic graph

conversational interface

evidence-grounded answers

This proves the fundamental idea.

PHASE 2 — THE THINKING ENGINE

Add:

contradiction detection

hypothesis management

alternative explanations

falsification

triangulation

skepticism

investigative questions

evidence weighting

audit trails

This is where she becomes The Detective.

PHASE 3 — HER VOICE

Add:

real-time speech

natural conversation

interruption

barge-in

conversational memory

voice personality

spoken evidence references

verbal case briefings

Now investigators can talk to her.

PHASE 4 — MULTIMODAL DETECTIVE

Add:

image analysis

video analysis

audio analysis

OCR

•

•

•

•

•

•

•

•

•

•

•

•

•

•

•

•

•

•

•

•

•

•

•

•

•

•

39


===== PAGE 40 =====
maps

structured datasets

advanced timeline analysis

Now she can reason across different evidence types.

PHASE 5 — SPECIALIST AGENTS

Introduce:

Archivist

Chronologist

Cartographer

Interview Analyst

Source Analyst

Contradiction Analyst

Skeptic

Verifier

Hypothesis Engine

Reporter

The Detective becomes an AI investigative team.

PHASE 6 — PROACTIVE DETECTIVE

She starts monitoring authorised case information.

New evidence arrives.

She determines:

"Does this change anything?"

Then alerts the investigator when something materially changes.

PHASE 7 — INVESTIGATIVE INTELLIGENCE PLATFORM

Eventually:

Cold cases

Current cases

Investigative journalism

Documentary research

•

•

•

•

•

•

•

•

•

•

•

•

•

40


===== PAGE 41 =====
Academic research

Legal research

Organisational investigations

could all use the same underlying platform.

The methodology remains constant while domain-specific configurations change.

58. THE LONG-TERM VISION

The ultimate version of The Detective is not a chatbot.

It is a living investigative environment.

The investigator walks into the system and says:

"Detective, where are we with Case 47?"

She already knows.

"We've processed 1,284 evidence items. There are 27 unresolved contradictions. Three

new pieces of information were added yesterday. One materially affects our previous

timeline. We currently have four active hypotheses. Would you like the short briefing or

should we go directly to the new evidence?"

The investigator:

"Short briefing."

She gives it.

"Now show me what's bothering you."

She responds:

"There are two things I think we haven't adequately explained."

That is the experience we should be aiming for.

41


===== PAGE 42 =====
59. THE FINAL PRODUCT DEFINITION

THE DETECTIVE

A voice-first, multimodal, evidence-grounded investigative intelligence platform that combines

academic research methodology, investigative reasoning, structured evidence management,

knowledge graphs, agentic AI and human oversight to help authorised investigators understand

complex cases, identify contradictions, evaluate competing hypotheses, discover knowledge gaps

and determine what should be investigated next.

She is not designed to solve crimes by guessing the perpetrator.

She is designed to make the investigation itself dramatically more intelligent.

60. HER CORE PROMISE

You bring the case.

She brings the investigation.

Or, for a harder-edged brand:

She doesn't guess. She investigates.

And internally, her deepest rule remains:

Let's stay with what we can prove.

61. THE MASTER BUILDING PRINCIPLE

When we eventually start writing the actual Lovable/Claude/backend prompts, we should not write one

gigantic prompt saying "build an AI detective."

We should build her in layers:

PROMPT 01 — Product Constitution

Defines who she is and what she must never do.

PROMPT 02 — Evidence Architecture

Defines evidence objects, provenance and source hierarchy.

PROMPT 03 — Case Memory

42


===== PAGE 43 =====
Defines how she remembers.

PROMPT 04 — Case Graph

Defines entities and relationships.

PROMPT 05 — Timeline Engine

Defines event extraction and temporal reasoning.

PROMPT 06 — Contradiction Engine

Defines how conflicts are detected and represented.

PROMPT 07 — Hypothesis Engine

Defines competing explanations.

PROMPT 08 — Skeptic Engine

Defines how she challenges herself and the investigator.

PROMPT 09 — Research Methodology

Defines academic and investigative principles.

PROMPT 10 — Voice Personality

Defines how she speaks.

PROMPT 11 — Conversational Runtime

Defines interruption, context and real-time interaction.

PROMPT 12 — Specialist Agents

Defines her investigative team.

PROMPT 13 — Verification Engine

Defines evidence-grounded validation.

PROMPT 14 — Human Oversight

Defines what requires human approval.

PROMPT 15 — Security & Audit

Defines privacy, permissions and traceability.

43


===== PAGE 44 =====
PROMPT 16 — Cold Case Mode

Defines historical investigation.

PROMPT 17 — Active Case Mode

Defines continuously changing investigations.

PROMPT 18 — Multimodal Intelligence

Defines text, image, audio, video and structured data.

PROMPT 19 — Proactive Intelligence

Defines when she should surface new findings without being asked.

PROMPT 20 — Future Model Abstraction

Ensures the system can swap AI models as technology advances.

THE NORTH STAR

If we get this right, the future Detective shouldn't feel like:

"I am talking to an AI."

It should feel like:

"I have another investigator in the room."

But underneath that personality is something even more important:

a rigorous evidence system, an academic research methodology, a skeptical reasoning engine, a

persistent case memory, a multimodal intelligence layer, and an auditable trail showing how

every important conclusion was reached.

That is the version worth building.

44