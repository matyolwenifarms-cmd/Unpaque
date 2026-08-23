# UNPAQUE — THE DETECTIVE
Claude Code Master Build Specification | Investigative Intelligence Feature

**VERSION 1.1 • AUDITED 20 AUGUST 2026** (v1.0 original + audit addendums, marked inline as `(AUDIT ADDENDUM)`)

A production-grade investigative intelligence system inside UNPAQUE

Core principle: DON'T JUST TELL ME. SHOW ME.

Working proposition: She doesn't guess. She investigates.

---

## Audit note
This version fixes one formatting defect (a duplicated section-0 heading) and adds inline addendums, each clearly marked `(AUDIT ADDENDUM)`, closing gaps that the original left ambiguous for an autonomous build: field-level schemas for Person/Organisation/Location/Statement/Analysis/Investigation, a case-graph edge schema, dossier version-record and concurrency handling, a reference AI provider default, a greenfield-repository fallback, job retry/rate-limit bounds, a demo-case naming caution, and phase exit criteria. Everything else is the original specification, unchanged in substance.

---

# 0. MASTER INSTRUCTION TO CLAUDE CODE
You are implementing THE DETECTIVE as a major feature/module inside the existing UNPAQUE platform. UNPAQUE is the parent communication diagnostic system. It contains multiple specialised experiences, including: (1) Unpack — communication diagnostics, (2) The Researcher — academic research support, and (3) The Detective — investigative work.
THE DETECTIVE must therefore be built as a bounded, modular investigative subsystem within UNPAQUE, not as a separate application that duplicates UNPAQUE's authentication, account, navigation, billing, design system, storage, analytics or infrastructure.
The two supplied source documents are the authoritative product basis for The Detective. This specification consolidates them into one implementation brief for Claude Code. Preserve their terminology, principles and investigative logic. Where a technical decision is not specified, inspect the existing UNPAQUE repository and choose the smallest architecture that fits it. Do not invent a competing stack simply because one is familiar.
CRITICAL: Before writing significant code, inspect the repository, identify the current stack, authentication, database, media/storage, AI integrations, UI system, routing, billing and existing feature/module boundaries. Produce an architecture assessment and implementation plan before modifying foundational code.

## Missing source documents (AUDIT ADDENDUM)
This specification states it consolidates two supplied source documents — "The Detective — Master System Build" (89 pages) and "The Detective — Comprehensive Concept & Master Product Architecture" (44 pages) — and instructs Claude Code to preserve their terminology and logic. Those two documents were not provided alongside this specification. If they are not available in the repository or project files when the build begins, Claude Code should treat this consolidated specification as fully authoritative on its own and proceed without blocking on their absence — everything needed to start Phase 0–1 is present in this document. If the source documents are later located, reconcile any conflicts in favour of this specification, since it is the one written specifically as an implementation brief.

## No existing UNPAQUE repository (AUDIT ADDENDUM)
This document assumes a UNPAQUE repository already exists and repeatedly instructs Claude Code to inspect it and reuse its primitives rather than choosing a stack. It does not say what to do if the repository is empty or UNPAQUE does not yet exist. If Phase 0 inspection finds no existing application to integrate with, do not block — proceed with the smallest reasonable default stack instead of inventing an elaborate one: a TypeScript full-stack framework (e.g. Next.js) for UI + server actions/API, a relational database (e.g. Postgres) accessed through a typed ORM/migration tool, object storage for media, a background-job/queue mechanism backed by the same database or a lightweight queue, and the Anthropic API as the reference AI provider (see §23 addendum). Flag this assumption explicitly in the architecture assessment so a human can confirm or override it before Phase 1 proceeds.

## Non-negotiable architectural rule
Do NOT build The Detective as CHAT UI + SEARCH API + LLM.
Build it as an INVESTIGATIVE PLATFORM composed of: CASE ENGINE + RESEARCH ENGINE + SOURCE ENGINE + MEDIA ENGINE + DOSSIER ENGINE + EVIDENCE ENGINE + TIMELINE ENGINE + AI ANALYSIS ENGINE + COLLABORATION ENGINE + PRIVACY ENGINE + BROADCAST ENGINE. The conversational interface is one control surface for the system, not the system itself.

## Implementation rule
For every major capability, implement vertically:
DATA MODEL
    ↓
BACKEND / SERVICE
    ↓
API / SERVER ACTION
    ↓
STATE
    ↓
UI
    ↓
TESTS
Do not create disconnected mock interfaces that cannot later be connected to real data. Mock data is acceptable for demonstrations, but component contracts must match the eventual real data contracts.

# 1. UNPAQUE PRODUCT CONTEXT


| UNPAQUE feature | Primary purpose | Relationship to The Detective |
|---|---|---|
| Unpack | Communication diagnostics | Separate feature; do not couple investigative data models to communication-diagnostic workflows unless the existing UNPAQUE architecture already provides shared primitives. |
| The Researcher | Academic research support | Separate feature; may share research/provider abstractions, document processing and evidence/provenance infrastructure where appropriate. |
| The Detective | Investigative intelligence | This specification. Owns the case/dossier/evidence/timeline/claim/contradiction/hypothesis investigative domain. |


## Shared-platform principle
Reuse UNPAQUE authentication and user identity.
Reuse existing tenant/account/workspace boundaries if present.
Reuse existing design tokens and UI primitives where they can support the Detective aesthetic.
Reuse existing AI/provider abstractions where they are genuinely compatible.
Reuse existing billing/entitlement infrastructure if present; otherwise create an abstraction that does not lock the feature to a provider.
Reuse existing storage/media infrastructure where possible.
Do not duplicate an existing UNPAQUE capability simply because The Detective needs it.
Do not allow The Detective's specialised security requirements to weaken UNPAQUE's existing security model.

# 2. PRODUCT DEFINITION
THE DETECTIVE is a voice-first, multimodal, evidence-grounded investigative intelligence platform. It combines investigative journalism methodology, academic research methodology, qualitative and quantitative analysis, evidence analysis, chronology reconstruction, relationship analysis, multimodal AI, knowledge graphs, document intelligence, voice interaction, geographic analysis, digital evidence analysis, source verification, contradiction detection, provenance tracking, agentic AI and human oversight.
The Detective does not determine guilt, replace investigators, or turn allegations into facts. Its purpose is to help an authorised investigator answer: What does the available evidence actually allow us to say? What remains unknown? What does not fit? What should we investigate next?
The product should feel like an extraordinarily competent investigative colleague, not a fictional detective, generic chatbot or conspiracy assistant.

## Core promise
Give The Detective a case.
Don't just hear the story. Investigate it.
Don't just tell me. Show me.
The public record is waiting.
Build the dossier. Follow the evidence.

## What success means
The Detective is successful when the investigator knows more than before and can inspect why — not merely when the AI produces an apparently accurate answer.

# 3. THE DETECTIVE CONSTITUTION

## Identity
Female conversational identity.
Calm, intelligent, measured, attentive and natural.
Exceptionally curious and disciplined.
Skeptical without being cynical.
Analytical without being cold.
Willing to challenge the investigator.
Never pretends to know what she does not know.
Never manufactures certainty.
Her permanent question: 'What else could explain this?'
Her defining discipline: 'Let's stay with what we can prove.'

## Investigative principles — implement these as system rules, not merely prompt text
Evidence before assumption.
Every important claim has a source.
Claims are not facts.
Corroboration matters; repeated copying is not independent corroboration.
Contradictions must be surfaced.
Alternative explanations must be considered.
Correlation is not causation.
Absence of evidence is not automatically evidence of absence.
Confidence reflects evidence quality, not model confidence.
The investigator's theory is a hypothesis, not a fact.
Falsification is mandatory: ask what would prove a hypothesis wrong.
Every important conclusion must be traceable to inference, evidence and original source.
Unknown is a legitimate answer.
Human authority remains explicit for consequential investigative decisions.

# 4. EPISTEMIC / EVIDENCE MODEL
The system must never casually collapse information into 'truth'. Every important item needs an epistemic classification and/or evidential status.


| Classification | Meaning | Required behaviour |
|---|---|---|
| FACT | Directly supported factual observation from a source. | Present as an observation; retain provenance. |
| CLAIM | Something a person or source asserts. | Do not convert into fact merely because it is repeated. |
| INFERENCE | Conclusion derived from multiple pieces of information. | Show supporting evidence and reasoning category. |
| UNRESOLVED | Available public record cannot establish the answer. | State uncertainty and identify what could resolve it. |
| CORROBORATED | Independent evidence converges on the proposition. | Show independent supporting sources. |
| PARTIALLY CORROBORATED | Some elements are supported, others remain uncertain. | Explain which elements are supported. |
| CONTESTED | Sources or evidence conflict. | Show the conflict; do not silently choose a side. |
| CONTRADICTED | Evidence directly conflicts with the proposition. | Show source A/source B and exact difference. |
| UNVERIFIED | Claim/evidence lacks adequate verification. | Do not elevate its evidential weight. |
| DISPUTED | The matter is actively disputed. | Preserve competing accounts. |
| UNKNOWN | The system does not currently know. | This is a valid state, not a failure. |


## Language discipline


| Evidence strength | Preferred language |
|---|---|
| Strong | The available records establish... |
| Moderate | The evidence strongly supports... |
| Limited | The evidence is consistent with... |
| Uncertain | There are several plausible explanations... |
| Unsupported | I cannot substantiate that claim from the available evidence. |
| Contradictory | The evidence is currently contested. |


# 5. CORE DOMAIN OBJECTS
The database and service architecture should be built around these primitives rather than one large JSON case blob.
USER
CASE
DOSSIER
SOURCE
MEDIA
DOCUMENT
EVIDENCE
CLAIM
PERSON
ORGANISATION
LOCATION
EVENT
TIMELINE_EVENT
STATEMENT
QUESTION
CONTRADICTION
ANALYSIS
INVESTIGATION
COLLABORATOR
PERMISSION
AUDIT_EVENT

## Case
A CASE is the user's investigative subject. Examples include a disappearance, event, claim, commission, historical mystery, business controversy or unresolved issue.


| Field | Requirement |
|---|---|
| case_id | Unique identifier. |
| owner_id | Owning user/account. |
| title | Human-readable case title. |
| description | Case description. |
| original_question | Exact investigative question/request. |
| status | DRAFT / RESEARCHING / DOSSIER_ASSEMBLING / READY / ACTIVE_INVESTIGATION / PAUSED / ARCHIVED. |
| privacy_status | PRIVATE by default; explicit publication only. |
| investigation_mode | Cold case / current case / other configured mode. |
| jurisdiction | Optional country/region/city/court/jurisdiction. |
| language | Case language. |
| tags | Structured or flexible case tags. |
| created_at / updated_at | Lifecycle timestamps. |


## Dossier
The DOSSIER is the central intellectual object. It is not a list of search results; it is a structured representation of the public record surrounding the case.
Case overview
Source register
Media
Documents
People
Organisations
Locations
Events
Timeline
Claims
Statements
Evidence
Contradictions
Analysis
Questions
Unresolved issues
Source relationships
Evidence relationships
Dossiers must be versioned. Never silently overwrite important investigative information. Record what changed, when, why, which source caused the change, which user initiated it, and which AI process produced it.

## Dossier version record (AUDIT ADDENDUM)
The original spec mandates versioning but does not define the version record shape. Use this minimum:

| Field | Requirement |
|---|---|
| version_id | Unique identifier. |
| dossier_id | Parent dossier. |
| changed_at | Timestamp. |
| changed_by_user_id | Human initiator, nullable if AI-initiated. |
| changed_by_process | AI job / pipeline identifier, nullable if human-initiated. |
| triggering_source_id | Source that caused the change, if applicable. |
| change_summary | Human-readable description of what changed. |
| diff | Structured before/after for the changed fields/objects. |

## Concurrent edit handling (AUDIT ADDENDUM)
The spec does not state what happens when two collaborators or a collaborator and a background job change the same object concurrently. Default rule: last-write-wins at the field level is NOT acceptable for evidence-bearing objects. Use optimistic concurrency (a version/updated_at check) on CASE, DOSSIER, EVIDENCE, CLAIM, CONTRADICTION and HYPOTHESIS writes; reject stale writes and surface a conflict to the client rather than silently overwriting. AI-pipeline writes to these objects must go through the same versioned-update path as human edits — never a direct table write that bypasses the version record above.

## Person / Organisation / Location objects (AUDIT ADDENDUM)
Case, Source, Event and Evidence each received a field table in the source document; PERSON, ORGANISATION and LOCATION did not. Use this minimum so Phase 1 has something concrete to build against:

| PERSON field | Requirement |
|---|---|
| person_id | Unique identifier. |
| display_name | Primary name used in the case. |
| aliases | Alternate names/spellings encountered in sources. |
| role_in_case | e.g. subject, witness, official, journalist, other — configurable, not a fixed enum. |
| description | Neutral, evidence-grounded description. |
| sources | Sources establishing the person's involvement. |
| related_events / related_claims / related_evidence | Relationship references. |
| sensitive | Boolean/flag if the person is a minor or the record contains sensitive personal data (see §18). |

| ORGANISATION field | Requirement |
|---|---|
| organisation_id | Unique identifier. |
| name | Organisation name. |
| type | e.g. company, government body, NGO, media outlet — configurable. |
| description | Neutral description. |
| sources | Sources establishing relevance. |
| related_people / related_events / related_evidence | Relationship references. |

| LOCATION field | Requirement |
|---|---|
| location_id | Unique identifier. |
| name | Human-readable location name. |
| coordinates | Lat/long where known. |
| precision | e.g. exact, approximate, unknown — mirrors Event's confidence discipline. |
| description | Neutral description. |
| sources | Sources establishing the location. |
| related_events / related_people | Relationship references. |

## Statement, Question and Analysis objects (AUDIT ADDENDUM)
STATEMENT, QUESTION and ANALYSIS appear in the Core Domain Objects list (§5) but only QUESTION receives a field table later (§20, "What Don't We Know?"), and that table is UI-facing rather than a storage schema. Minimum schemas:

| STATEMENT field | Requirement |
|---|---|
| statement_id | Unique identifier. |
| speaker_person_id | Who made the statement. |
| source_id / media_id | Provenance; timestamp or page if applicable. |
| text | The statement content (verbatim where transcribed). |
| statement_date | When it was made, if different from publication/retrieval date. |
| related_claims | Claims this statement supports or is examined against. |
| supersedes_statement_id | Nullable — links to an earlier statement by the same speaker on the same topic, to support interview-analysis change-tracking (§21). |

| ANALYSIS field | Requirement |
|---|---|
| analysis_id | Unique identifier. |
| case_id | Parent case. |
| analysis_type | e.g. contradiction analysis, hypothesis evaluation, timeline analysis, source assessment. |
| produced_by | Human, AI agent identifier, or both. |
| summary | Human-readable output. |
| supporting_evidence / supporting_claims | Traceability references (see §17 source-to-conclusion traceability). |
| confidence | Evidence-grounded, not model-confidence (per §4). |
| created_at | Timestamp. |

INVESTIGATION is listed in §5 as a core domain object but is never independently defined elsewhere in the spec — it appears to be either (a) a synonym for CASE, or (b) a distinct object representing one research/analysis cycle within a case (consistent with `investigation_mode` on Case and the `Investigation` operations group in §29's API table, which only lists `askDetective` / `executeCommand` / `getConversationHistory` — actually the Conversation domain, not a distinct Investigation domain). Recommend Claude Code treat INVESTIGATION as a lightweight join concept — one CASE has one or more INVESTIGATION records, each capturing a research/analysis cycle (start question, jobs run, dossier version produced) — rather than building a second full entity in parallel with Case. Confirm this interpretation with the product owner before building a separate INVESTIGATION table.

# 6. SOURCE, MEDIA AND PROVENANCE

## Source types
NEWS_ARTICLE
VIDEO
AUDIO
PODCAST
RADIO
TELEVISION
COURT_DOCUMENT
COMMISSION_DOCUMENT
PARLIAMENTARY_RECORD
GOVERNMENT_DOCUMENT
ACADEMIC_PAPER
PRESS_RELEASE
PHOTOGRAPH
SOCIAL_MEDIA
PUBLIC_DATABASE
ARCHIVE
OTHER

## Source fields


| Field | Purpose |
|---|---|
| source_id | Stable source identity. |
| source_type | Source classification. |
| title | Source title. |
| publisher / author | Origin metadata. |
| publication_date | Original publication date if known. |
| retrieved_at | Retrieval timestamp. |
| original_url | Original source location. |
| canonical_url | Canonicalised location. |
| language | Source language. |
| description | Source summary/metadata. |
| source_status | Available, unavailable, changed, etc. |
| content_hash | Integrity/deduplication support where applicable. |
| parsed_text / metadata / media references | Structured extraction references. |


## Provenance requirement
Every extracted item must maintain a source path. Examples:
CLAIM-031
  ↓
SOURCE-017
  ↓
DOCUMENT
  ↓
PAGE 42
or
CLAIM-031
  ↓
SOURCE-021
  ↓
VIDEO
  ↓
TIMESTAMP 01:42:17
Never create an orphaned AI statement with no source relationship.

## Source lineage and duplication
The same story appearing on 50 websites must not automatically count as 50 independent sources. Detect probable syndication/republication lineage and show primary, secondary, independent and republication relationships.
The Detective should be able to say: 'This claim appears in 14 articles, but most appear to derive from the same original report.'

## Source quality
Proximity to the event
Primary vs secondary
Author identification
Publication date
Corroboration
Originality
Editorial transparency
Document provenance
Direct quotation
Independent confirmation
Do not reduce source quality to one simplistic number. Use explainable indicators.

# 7. MULTIMEDIA INTELLIGENCE

## Universal MediaViewer
Create a reusable MediaViewer abstraction that dynamically renders:
VideoViewer
AudioViewer
ImageViewer
DocumentViewer
PdfViewer
WebViewer
TranscriptViewer
TimelineViewer
EvidenceComparisonViewer
The central investigative screen must not assume every source is video.

## Video
Public video URLs where permitted
Embedded video
Direct video files where legally/technically permitted
Timestamp targeting
Playback, pause and scrubbing
Relevant segment marking
Transcript synchronization
Source metadata

## Audio
Playback, pause and scrubbing
Waveform
Transcript
Timestamp navigation
Speaker identification where technically possible
Relevant segment highlighting

## Images
Fullscreen and zoom
Metadata
Source attribution
Caption and date
Case relationship

## Documents
PDF viewing
Page navigation
Text extraction
Search
Highlighting
Source attribution
Page references
Relevant passage extraction

# 8. TRANSCRIPTION, ENTITY AND EVENT ENGINES

## Transcription pipeline
MEDIA
  ↓
AUDIO EXTRACTION
  ↓
TRANSCRIPTION
  ↓
SPEAKER SEGMENTATION
  ↓
TIMESTAMP ALIGNMENT
  ↓
ENTITY EXTRACTION
  ↓
CLAIM EXTRACTION
  ↓
STATEMENT EXTRACTION
Transcript entries should contain speaker, start_time, end_time, text and confidence. Transcript remains linked to original media.

## Entity extraction
People
Organisations
Places / locations
Events
Dates and times
Documents
Institutions
Products
Vehicles
Other meaningful entities

## Event object


| Field | Requirement |
|---|---|
| event_id | Unique event identity. |
| date / time | Exact or approximate temporal value. |
| location | Location relationship. |
| description | Event description. |
| people | Linked people. |
| sources | Supporting sources. |
| confidence | Evidence-grounded confidence. |
| status | Confirmed / claimed / approximate / conflicting / unknown as appropriate. |


# 9. TIMELINE ENGINE
The Detective automatically constructs a chronological reconstruction from identified events.
Confirmed dates
Claimed dates
Approximate dates
Conflicting dates
Unknown dates

## Timeline conflict example
STATEMENT A
Person says they left Location X at 20:00.
CCTV
Vehicle associated with the person appears at Location X at 20:37.
PHONE RECORD
Device is associated with activity near Location X at 20:41.
SYSTEM RESULT
TIMELINE DISCREPANCY DETECTED
NOT:
"The person lied."
INSTEAD:
Possible explanations + additional evidence needed to distinguish them.

# 10. CLAIM, EVIDENCE AND CONTRADICTION ENGINES

## Claim engine
A claim is something that needs examination. Keep the claim separate from the evidence supporting or challenging it.
CLAIM-038
"Person X met Person Y on 14 June."
SUPPORTED BY:
SOURCE 014
CHALLENGED BY:
SOURCE 027
STATUS:
CONTESTED

## Evidence object


| Field | Purpose |
|---|---|
| evidence_id | Stable evidence identity. |
| source_id / media_id | Provenance. |
| type | Evidence type. |
| description | What the evidence is. |
| timestamp / page | Precise location inside media/document. |
| status | Evidence status. |
| confidence | Evidence-grounded confidence. |
| related_claims | Claims supported/challenged. |
| related_people | People relationships. |
| related_events | Event relationships. |
| human_verification_status | Whether reviewed by a human. |
| access_permissions | Evidence-level security if required. |
| chain_of_custody | Where applicable. |


## Evidence classifications
PRIMARY
CORROBORATING
SECONDARY
CONTEXTUAL
CLAIM
UNVERIFIED
DISPUTED
CONTRADICTORY
UNRESOLVED

## Contradiction engine
Search for:
Different dates
Different locations
Different sequences
Different descriptions
Different statements
Conflicting names
Conflicting numbers
Conflicting accounts
Do not automatically label something a contradiction merely because wording differs. Use POTENTIAL CONTRADICTION until verified.

## Contradiction record must contain
Source A
Source B
Exact difference
Possible explanations
Significance
Unresolved status
Contradiction types may include direct, temporal, geographic, narrative, documentary and evidentiary contradictions.

# 11. CASE GRAPH
The case graph represents people, organisations, locations, vehicles, events, documents, communications, dates, times, transactions, photographs, recordings, claims and evidence as connected nodes.
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
Use relational join tables for graph-like relationships rather than forcing the entire case into one JSON blob. JSON is acceptable for flexible metadata, not as the whole case.

## Case graph edge schema (AUDIT ADDENDUM)
The relationship verbs above are listed but no edge/join-table shape is specified. Minimum schema for the join table(s) backing the graph:

| Field | Requirement |
|---|---|
| edge_id | Unique identifier. |
| case_id | Parent case (all edges are case-scoped). |
| source_node_type / source_node_id | Polymorphic reference to the origin node (Person, Organisation, Location, Event, Document, Claim, Evidence, etc.). |
| target_node_type / target_node_id | Polymorphic reference to the destination node. |
| relation_type | One of the verbs above, or a case-specific extension. |
| direction | Directed or symmetric — most verbs above are directional (e.g. "contacted") but a few are symmetric (e.g. "geographically connected to"); the schema should support both rather than forcing every relation into a single direction. |
| confidence | Evidence-grounded, per §4. |
| supporting_evidence_ids | Evidence backing the existence of this relationship — an edge is itself a claim and needs provenance like any other. |
| created_by_user_id / created_by_process | Human vs AI origin, mirroring the dossier version record. |
| created_at | Timestamp. |

## Initial graph view
PERSON A
  |
  | attended
  ↓
EVENT B
  |
  | documented by
  ↓
SOURCE C
  |
  | contains
  ↓
EVIDENCE D
  |
  | supports
  ↓
CLAIM E

# 12. HYPOTHESIS, FALSIFICATION AND SKEPTIC ENGINES

## Competing hypotheses
The Detective must never be forced into one theory. Maintain competing explanations.
Hypothesis A — Person A was involved.
Hypothesis B — Person A was not involved.
Hypothesis C — A third party explains the available evidence.
For each hypothesis track: supporting evidence, contradicting evidence, missing evidence, assumptions, alternative explanations and discriminating questions.

## Falsification
For every major hypothesis, ask: What would make us abandon this theory? Actively search for evidence that could disprove or weaken it.

## Skeptic engine
What assumptions are we making?
What evidence is missing?
Could there be another explanation?
Is the source reliable?
Is the evidence genuinely independent?
Could the evidence be incomplete?
Are we confusing correlation with causation?
Are we overinterpreting ambiguous information?
Are we giving too much weight to one source?
Are we favouring the investigator's preferred theory?
The Skeptic may challenge the Detective herself.

# 13. RESEARCH ORCHESTRATOR
The research layer must be provider-agnostic. Do not hard-code The Detective to one search engine, retrieval provider, media provider or AI model.

## Provider interfaces
SearchProvider
NewsProvider
VideoProvider
ArchiveProvider
DocumentProvider
WebRetrievalProvider
Implement providers independently so new providers can be added without rewriting the application.

## Research pipeline
USER QUESTION
  ↓
QUERY DECOMPOSITION
  ↓
SEARCH STRATEGY
  ↓
SOURCE DISCOVERY
  ↓
SOURCE DEDUPLICATION
  ↓
SOURCE RETRIEVAL
  ↓
CONTENT EXTRACTION
  ↓
MEDIA IDENTIFICATION
  ↓
TRANSCRIPTION
  ↓
ENTITY EXTRACTION
  ↓
CLAIM EXTRACTION
  ↓
EVENT EXTRACTION
  ↓
SOURCE CROSS-REFERENCE
  ↓
DOSSIER CONSTRUCTION

## Query decomposition
Do not perform one giant search. Break the case into research questions.
Who/what is the subject?
When did the event occur?
Where did it occur?
Who was involved?
What was publicly reported?
What did authorities say?
What did witnesses say?
What documents exist?
What media exists?
What timeline can be established?
Which claims are disputed?
What remains unknown?

## Source hierarchy
Primary documents
Official records
Direct testimony
Original video/audio
Reputable reporting
Secondary reporting
Archives
Other public material
The hierarchy must be configurable.

# 14. DOSSIER ASSEMBLY EXPERIENCE
When research begins, the user should see meaningful investigative progress rather than a generic spinner.
CASE REQUEST RECEIVED
ANALYSING QUESTION
DECOMPOSING INVESTIGATION
SEARCHING PUBLIC RECORD
DISCOVERING SOURCES
INDEXING MEDIA
TRANSCRIBING AUDIO
EXTRACTING ENTITIES
BUILDING TIMELINE
CROSS-REFERENCING SOURCES
ANALYSING CLAIMS
IDENTIFYING POTENTIAL CONTRADICTIONS
CONSTRUCTING EVIDENCE GRAPH
ASSEMBLING DOSSIER
DOSSIER READY

## Live dossier events
SOURCE FOUND
SOURCE INDEXED
RELEVANT PASSAGE IDENTIFIED
PERSON IDENTIFIED
EVENT IDENTIFIED
CLAIM IDENTIFIED
RELATIONSHIP CREATED

# 15. INVESTIGATIVE CONSOLE / CASE ROOM
The core desktop interface is a cinematic investigative command centre. Desktop is the primary experience.
┌──────────────────────────────────────────────────────────────┐
│ THE DETECTIVE CASE 001 ● ONLINE                             │
├───────────────┬──────────────────────────────┬───────────────┤
│ CASE          │                              │ EVIDENCE      │
│ OVERVIEW      │                              │ E-001         │
│ TIMELINE      │       MEDIA WINDOW           │ E-002         │
│ PEOPLE        │                              │ E-003         │
│ LOCATIONS     │                              │ E-004         │
│ CLAIMS        │                              │               │
│ EVIDENCE      │                              │               │
│ SOURCES       │                              │               │
│ DOCUMENTS     │                              │               │
│ MEDIA         │                              │               │
├───────────────┴──────────────────────────────┴───────────────┤
│ TRANSCRIPT │ SOURCE │ ANALYSIS │ QUESTIONS                  │
├──────────────────────────────────────────────────────────────┤
│ DETECTIVE                                                     │
│ Three sources contain relevant statements.                   │
│ [SHOW EVIDENCE] [COMPARE SOURCES] [BUILD TIMELINE]           │
└──────────────────────────────────────────────────────────────┘

## Left navigation
Overview
Timeline
People
Organisations
Locations
Claims
Evidence
Sources
Media
Documents
Questions
Contradictions
Analysis
Hypotheses
Map
Conversation
Audit

## Right evidence panel
Clicking an evidence item changes the central media/intelligence view. Display evidence ID, type, source, timestamp/page and relevant status.

## Lower intelligence panel
Transcript
Source
Analysis
Questions
Transcript must synchronize with media.

# 16. COMMAND-DRIVEN AND CONVERSATIONAL INVESTIGATION
Natural language is the primary control layer, but all actions must resolve into reusable application commands.
SHOW EVIDENCE
SHOW SOURCE
PLAY MEDIA
COMPARE SOURCES
BUILD TIMELINE
TRACE PERSON
TRACE EVENT
EXAMINE CLAIM
OPEN DOCUMENT
SHOW PHOTOGRAPH
SHOW TRANSCRIPT
FIND CONTRADICTIONS
SHOW UNRESOLVED
EXPAND INVESTIGATION
UPDATE DOSSIER

## Conversational modes


| Mode | Example |
|---|---|
| INVESTIGATE | Follow this lead. |
| ANALYSE | Explain the contradiction. |
| RECALL | What did Witness Four say? |
| TIMELINE | Where was everyone at 10? |
| HYPOTHESIS | What are our competing explanations? |
| CHALLENGE | What's the strongest argument against our theory? |
| BRIEF | Give me a two-minute briefing. |
| REPORT | Prepare an investigative summary. |


## Conversational memory separation


| Memory | What it contains |
|---|---|
| Case Memory | Established case information. |
| Conversation Memory | What investigator and Detective discussed. |
| Evidence Memory | Actual evidence and provenance. |
| Analytical Memory | Previous hypotheses, analyses and investigative decisions. |
| Uncertainty Memory | Unresolved questions and evidence gaps. |

A conversational statement must never accidentally become case fact.

# 17. REPORTING SYSTEM
Executive Brief — one-minute overview.
Investigator Brief — detailed analytical summary.
Evidence Report — evidence-by-evidence analysis.
Contradiction Report — significant inconsistencies.
Timeline Report — chronological reconstruction.
Hypothesis Report — competing explanations.
Research Gap Report — what remains unknown.
Audit Report — what the AI did, which tools it used and what evidence supported its conclusions.

## Source-to-conclusion traceability
Every important generated sentence should ideally be traceable. The investigator should be able to ask 'Why are you saying that?' and receive source, evidence, reasoning category, confidence and competing interpretations.

# 18. PRIVACY, SECURITY, LEGAL AND ETHICAL GUARDRAILS

## Case privacy
Every case is PRIVATE by default.
No public dossier URL by default.
No public case directory by default.
No automatic social sharing.
No automatic publication.
No automatic inclusion in television.
Publishing is an explicit, confirmed action.
Private notes must remain separate from public evidence, AI analysis and shared collaborator notes.

## Collaboration


| Role | Meaning |
|---|---|
| OWNER | Full ownership and case control. |
| INVESTIGATOR | Investigative access according to granted permissions. |
| EDITOR | Edit permitted case content. |
| RESEARCHER | Research-focused access. |
| VIEWER | Read-only access. |
| COMMENTER / SOURCE_CONTRIBUTOR / ANALYST | Future configurable permissions. |

Invitation → recipient accepts → access granted. Never grant access merely because someone has a link. Sharing and collaboration are separate concepts.

## Server-side security
Strong server-side authorization.
Never rely exclusively on frontend hiding.
Every request verifies user identity, case ownership/collaboration permission and resource access.
Use row-level security where supported by the database architecture.
Private cases must remain inaccessible even if an ID is guessed.
Tenant isolation where applicable.
Case-level and evidence-level permissions where needed.
Audit sensitive operations.

## Sensitive information
Personal addresses
Phone numbers
Email addresses
Financial information
Medical information
Minors
Sexual information
Private communications
Other sensitive personal information
Do not automatically make sensitive information prominent evidence merely because it is discoverable.

## Public does not mean unrestricted
Distinguish SOURCE IS PUBLIC from WE MAY REDISTRIBUTE THIS CONTENT. Media embedding, caching, downloading, transcription and display must respect applicable rights, licences and provider terms. Where appropriate, reference or embed original media rather than permanently duplicating it.

## Hard prohibitions
Never state an allegation as established fact.
Never infer guilt from association.
Never fabricate evidence.
Never encourage harassment.
Never expose private information merely because it can be found.
Never claim deception from voice, facial expression or linguistic patterns alone.
Never build a conspiracy-confirmation engine.

# 19. INVESTIGATION MODES

## Cold Case Mode
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
What technology now exists that could potentially help re-examine available evidence?
Distinguish historical investigative conclusion from present-day evidentiary assessment. Do not rewrite history simply because a new AI interpretation is interesting.

## Current Case Mode
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

# 20. QUESTIONS / KNOWLEDGE GAPS

## What Don't We Know?
This should be a core interaction. The Detective returns unresolved questions.


| Question field | Requirement |
|---|---|
| Question | The unresolved issue. |
| Why it matters | Investigative significance. |
| Current evidence | Evidence currently bearing on it. |
| Missing information | What is absent. |
| Hypotheses affected | Which competing explanations are affected. |
| Potential sources of resolution | Where to investigate next. |
| Priority | Configurable priority. |


## Investigative Question Generator
Transform evidence gaps into actionable research questions. Example: instead of 'missing information', say that the current evidence does not establish who had access during the relevant period and explain which hypotheses the answer would discriminate between.

# 21. GEOGRAPHIC, DIGITAL AND INTERVIEW INTELLIGENCE

## Geographic intelligence
Locations, routes, events, people and timestamps on a map.
Identify spatial inconsistencies and relationships.
Estimate whether proposed movement sequences are physically plausible where appropriate.
Clearly label assumptions.

## Authorised digital evidence
The product can analyse authorised datasets supplied to it, including documents, communication records, timestamps, metadata, photographs, video, audio, transaction data, location data and public information. Do not design around unauthorised access.
Principle: if the authorised investigator possesses the evidence, The Detective can analyse it.

## Interview analysis
Factual claims
Chronology
Inconsistencies
Changes between interviews
New information
Omissions
Recurring themes
Statements requiring corroboration
A changed account is an observation. It is not proof of deception.

# 22. MULTI-AGENT ARCHITECTURE
The Detective is the conversational identity and orchestrator. Specialist agents work underneath her. The investigator should experience one Detective.


| Agent | Primary responsibility |
|---|---|
| THE DETECTIVE | Orchestrator and final evidence-grounded synthesiser. |
| THE ARCHIVIST | Finds and organises evidence. |
| THE CHRONOLOGIST | Builds and tests timelines. |
| THE CARTOGRAPHER | Analyses geographic relationships. |
| THE INTERVIEW ANALYST | Analyses interviews and narrative changes. |
| THE SOURCE ANALYST | Evaluates provenance and source relationships. |
| THE CONTRADICTION ANALYST | Finds and structures inconsistencies. |
| THE SKEPTIC | Challenges assumptions and conclusions. |
| THE HYPOTHESIS ENGINE | Maintains competing explanations. |
| THE VERIFIER | Checks claims against evidence. |
| THE REPORTER | Creates human-readable reports. |


## Agent workflow
THE DETECTIVE
  ↓ What do we need to establish?
THE ARCHIVIST
  ↓ Find evidence
THE CHRONOLOGIST
  ↓ Reconstruct time
THE CARTOGRAPHER
  ↓ Analyse locations
THE CONTRADICTION ANALYST
  ↓ Compare claims
THE SKEPTIC
  ↓ Challenge assumptions
THE VERIFIER
  ↓ Check evidence
THE DETECTIVE
  ↓ Synthesise findings

## Research/Evidence agents
Research Agent: decomposes questions, discovers sources, evaluates relevance, identifies duplication and returns structured candidates. It must not directly alter the final dossier without passing through the dossier pipeline.
Evidence Agent: identifies evidence, links it to sources and claims, identifies potential contradictions and preserves provenance.
Source Verification Agent: checks metadata, duplication/syndication, primary source status and questionable provenance.
Security Agent: reviews authentication, authorization, RLS, endpoints, private cases, collaboration, file access, exports and secrets.
Test Agent: verifies unit, integration, end-to-end, permissions and critical workflows.

# 23. AI / MODEL ABSTRACTION
Do not permanently tie The Detective to one AI provider. Create a model abstraction layer so components can be independently upgraded.
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
Provider integrations must be behind adapters/interfaces. External integrations should not contaminate core business logic.

## Reference provider (AUDIT ADDENDUM)
The abstraction layer must not hard-code a provider, but Claude Code needs something concrete to build the first working adapter against. Unless the UNPAQUE repository already has a different AI provider wired in, use the Anthropic API (Claude) as the reference implementation behind the language/reasoning/vision model interfaces, and the existing UNPAQUE provider(s) for anything it already integrates (e.g. speech, OCR) rather than adding a second vendor for a capability UNPAQUE already has. This is a default for getting Phase 1 running, not a constraint on the abstraction itself.

# 24. VOICE-FIRST INTERACTION
Voice is a primary interface, not a decorative add-on. However, visual evidence remains primary.
HOST / INVESTIGATOR SPEECH
  ↓
SPEECH TO TEXT
  ↓
COMMAND INTERPRETATION
  ↓
INVESTIGATION ACTION
  ↓
MEDIA / EVIDENCE NAVIGATION
Streaming speech recognition
Streaming reasoning where supported
Streaming speech generation
Interruptions / barge-in
Immediate stopping
Context retention
Natural commands such as: Open source fourteen; Play from one forty-two; Pause; Show the photograph; Compare with the previous statement; Go back to the timeline.
The Detective should sound calm, intelligent, measured, attentive, natural, emotionally controlled and non-theatrical.

# 25. BROADCAST MODE
The same underlying system should support a television/broadcast experience. The television product demonstrates the platform; the consumer platform lets viewers become investigators.
1920×1080 target
16:9
Enlarge central media
Reduce unnecessary navigation
Increase readability
Show source identifiers
Show evidence numbers
Show timestamps
Show Detective analysis
Broadcast-safe layouts
Keyboard shortcuts
Eventually voice control

## Broadcast overlays
SOURCE 014
PUBLIC TESTIMONY
EVIDENCE E-031
01:42:17
THE DETECTIVE
CASE 001
POTENTIAL CONTRADICTION

# 26. SUBSCRIPTIONS, ENTITLEMENTS AND USAGE
The Detective is designed as a subscription product, but pricing must not be hard-coded into the feature.
FREE
INVESTIGATOR
PRO
PROFESSIONAL
Treat capabilities as entitlements. Possible entitlements include max_active_cases, monthly_research_units, media_processing, dossier_size, collaboration, export and advanced_analysis.

## Usage accounting
research_units
transcription_units
document_processing_units
AI_units
media_processing_units
storage
Do not directly tie the entire architecture to one provider's pricing.

## Billing abstraction
Create/use a BillingProvider abstraction so payment provider logic remains outside the Detective domain model. Prefer existing UNPAQUE billing infrastructure if present.

# 27. ADMINISTRATION, JOB QUEUES AND OBSERVABILITY

## Admin
Users
Authorised cases
Subscriptions
Usage
System health
Research providers
Media providers
Source ingestion
Failed jobs
Processing queues
Abuse reports
Security events

## Background jobs
CASE_RESEARCH
SOURCE_RETRIEVAL
VIDEO_PROCESSING
TRANSCRIPTION
DOCUMENT_EXTRACTION
ENTITY_EXTRACTION
TIMELINE_BUILD
DOSSIER_UPDATE
Long-running work must use background jobs. Never make the browser wait synchronously for the entire research pipeline.

## Retry bounds and rate limiting (AUDIT ADDENDUM)
The RETRYING job state is specified but no retry policy or external-provider rate limiting is. Research and retrieval jobs call third-party search/news/video/document providers on the investigator's behalf; without bounds, a stuck job or a burst of parallel investigations can hammer those providers or exhaust budget. Minimum requirements: every job type has a maximum retry count and backoff strategy; jobs that exhaust retries move to FAILED with a human-readable reason, not silent abandonment; the research orchestrator enforces per-user and per-provider concurrency/rate limits, independent of the usage-accounting entitlements in §26; a source that repeatedly fails is marked SOURCE UNAVAILABLE (per §27's failure handling) rather than retried indefinitely.

## Job states
QUEUED
PROCESSING
COMPLETED
FAILED
RETRYING

## Failure handling
If a source cannot be accessed: SOURCE UNAVAILABLE.
If transcription fails: TRANSCRIPTION FAILED.
If a source disappears: SOURCE NO LONGER AVAILABLE.
Preserve historical metadata where appropriate.
Never pretend unavailable/failed processing succeeded.

## Observability
Research jobs
Processing jobs
API errors
AI errors
Retrieval failures
Database errors
Media failures
Authentication failures
Permission violations

# 28. TECHNICAL ARCHITECTURE INSIDE UNPAQUE
Use the existing UNPAQUE stack. Do not introduce a new framework unless repository inspection proves it is necessary.

## Suggested modular boundaries
UNPAQUE
├── shared
│   ├── auth
│   ├── users
│   ├── billing
│   ├── ui
│   ├── storage
│   ├── analytics
│   └── ai-provider-abstractions
│
└── the-detective
    ├── case
    ├── dossier
    ├── source
    ├── media
    ├── evidence
    ├── claims
    ├── entities
    ├── timeline
    ├── contradictions
    ├── hypotheses
    ├── questions
    ├── research
    ├── conversation
    ├── collaboration
    ├── broadcast
    ├── reports
    ├── audit
    └── jobs
The exact folder structure is not mandatory. Modularity and clean domain boundaries are mandatory.

## Relational database principle
Use relational structures for Users, Cases, Dossiers, Sources, Media, Evidence, Claims, People, Events, Statements, Questions, Collaborators, Permissions and Audit Events. Use join tables for graph relationships. JSON is for flexible metadata, not for the entire case.

# 29. APPLICATION SERVICES / API CONTRACTS
Expose application capabilities through stable service/API contracts. Exact route naming must follow the existing UNPAQUE conventions.


| Domain | Representative operations |
|---|---|
| Cases | createCase, getCase, updateCase, archiveCase, setPrivacy, getCaseStatus |
| Research | startResearch, getResearchStatus, expandInvestigation, retryResearch |
| Sources | listSources, getSource, retrieveSource, compareSources, openOriginal |
| Media | getMedia, playSegment, seekTimestamp, getTranscript |
| Evidence | listEvidence, getEvidence, createEvidence, verifyEvidence |
| Claims | listClaims, getClaim, examineClaim, updateStatus |
| Timeline | getTimeline, buildTimeline, compareEvents |
| Entities | getPerson, tracePerson, getOrganisation, getLocation |
| Contradictions | listContradictions, inspectContradiction, markReviewed |
| Hypotheses | listHypotheses, createHypothesis, testHypothesis, falsifyHypothesis |
| Questions | listQuestions, investigateQuestion, markResolved |
| Conversation | askDetective, executeCommand, getConversationHistory |
| Collaboration | inviteCollaborator, acceptInvitation, changePermission, removeCollaborator |
| Reports | generateExecutiveBrief, evidenceReport, contradictionReport, timelineReport, hypothesisReport, researchGapReport, auditReport |
| Audit | getAuditTrail, getInvestigationHistory |

These are conceptual contracts, not a mandate to create REST endpoints if the existing UNPAQUE architecture uses server actions, RPCs, GraphQL or another pattern.

# 30. SECURITY IMPLEMENTATION CHECKLIST
Authentication is inherited from or integrated with UNPAQUE.
Every case query is scoped to authorised user/account/workspace.
Every evidence query is scoped to the case and permission model.
Collaborator invitations require acceptance.
Viewer cannot edit.
Researcher cannot change owner permissions.
Private notes are inaccessible to unauthorised users.
Guessing case IDs cannot expose data.
Exports are permission checked and audited.
Publication is explicit and audited.
Secrets never reach frontend code.
Provider keys live in server-side environment/secrets management.
Development/staging/production are separated.
Migrations are versioned.
Backups exist before production launch.
Deletion and retention policies are documented.
Sensitive operations are logged.
Security failures do not leak stack traces or private data.

# 31. ACCESSIBILITY, PERFORMANCE AND RESPONSIVENESS

## Accessibility
Keyboard navigation
Screen-reader support where practical
Visible focus states
Sufficient contrast
Captions
Transcript access
Accessible controls
Broadcast aesthetics must never compromise usability.

## Performance
Fast initial load
Lazy loading
Virtualised long lists
Progressive media loading
Cached metadata
Background processing
Efficient database queries
Large dossiers must not crash the browser

## Scale assumptions
Design for dossiers containing thousands of sources, thousands of evidence items, hundreds of people, thousands of events, large transcripts and multiple media assets. Do not assume a case has ten sources.

## Responsive strategy
Desktop: full investigative console; targets 1440×900, 1920×1080 and 2560×1440.
Tablet: media viewing, evidence inspection, timeline, source review and basic investigation.
Mobile: simplified Case → Evidence → Media → Analysis flow; do not attempt to replicate the full desktop console.

# 32. VISUAL / UX DESIGN SYSTEM
The Detective should feel intelligent, serious, cinematic, curious, precise, calm, powerful and trustworthy — not cheesy, paranoid, hacker-themed, conspiracy-themed, gamified or like a generic AI product.

## Reusable tokens
background
surface
surface-elevated
border
text-primary
text-secondary
accent
warning
danger
success

## Typography
Strong hierarchy
Compact metadata
High readability
Broadcast-safe sizes

## Iconography
Use consistent professional icons. Avoid emojis in the core interface.

## Loading states
ANALYSING SOURCE
INDEXING MEDIA
BUILDING TIMELINE
CROSS-REFERENCING EVIDENCE

## Empty states
NO CASES YET
Give The Detective a case.
[ BEGIN INVESTIGATION ]

# 33. FIRST-RUN EXPERIENCE
THE DETECTIVE
YOU ARE NOT SUPPOSED TO BE WATCHING
[ SYSTEM INITIALISING ]
PUBLIC RECORD ACCESS
MEDIA ARCHIVE
EVIDENCE ENGINE
DOSSIER ENGINE
SYSTEM ONLINE
GIVE THE DETECTIVE A CASE.
The cinematic activation line may be retained as an activation sequence. It should not define the entire product.
New users should understand immediately: 'You don't search. You investigate.'

## Case submission
GIVE THE DETECTIVE A CASE
Describe the case, person, event, claim or mystery you want investigated...
[ BEGIN INVESTIGATION ]
Submission creates a private case owned by the user.

# 34. INITIAL DEMONSTRATION CASE
The first serious prototype should include CASE 001 — MOGOTSI using mock data sufficient to demonstrate the complete investigative interaction.
Person
Video
Photograph
Article
Document
Audio
Transcript
Timeline
Claim
Contradiction
Evidence
Source register
Clearly mark mock data internally. Never represent fictional demo data as real evidence.

## Demo case naming (AUDIT ADDENDUM)
"MOGOTSI" is a real surname associated with real missing-persons cases and could read as referring to an actual person. Given this product's own hard prohibitions in §18 (never state an allegation as established fact, never expose or fabricate information about real people), the demo case should use a name and details that are unambiguously fictional and do not resemble any identifiable real person, case or news event — e.g. an invented full name plus a placeholder location/organisation. Treat "CASE 001" as the identifier and choose the fictional name at build time rather than reusing the working title from this spec verbatim.

## Minimum compelling demo
OPEN THE DETECTIVE
  ↓
CASE 001
  ↓
DOSSIER READY
  ↓
OPEN TIMELINE
  ↓
CLICK EVENT
  ↓
MEDIA OPENS
  ↓
CLICK SOURCE
  ↓
SOURCE PANEL OPENS
  ↓
PLAY VIDEO
  ↓
JUMP TO TIMESTAMP
  ↓
TRANSCRIPT HIGHLIGHTS
  ↓
CLICK CLAIM
  ↓
EVIDENCE PANEL OPENS
  ↓
COMPARE SOURCE
  ↓
CONTRADICTION VIEW
  ↓
RETURN TO DOSSIER

# 35. IMPLEMENTATION PHASES

## PHASE 0 — REPOSITORY ASSESSMENT
Inspect UNPAQUE stack and architecture.
Identify existing auth, database, storage, AI, billing, routing, UI, jobs and analytics.
Identify reusable primitives.
Identify conflicts and required boundaries.
Produce an architecture assessment before major code changes.

## PHASE 1 — INVESTIGATIVE FOUNDATION
Integrate feature navigation.
Case creation and privacy.
Dossier object/versioning.
Source registry and provenance.
Evidence objects.
Media abstraction.
Timeline foundation.
Claims.
People/entities.
Basic investigative console.
Tests.

## PHASE 2 — THINKING ENGINE
Contradiction detection.
Hypothesis management.
Alternative explanations.
Falsification.
Triangulation.
Skeptic engine.
Investigative questions.
Evidence weighting.
Audit trails.

## PHASE 3 — VOICE
Speech recognition.
Natural conversation.
Interruptions/barge-in.
Conversational memory.
Voice personality.
Spoken evidence references.
Verbal briefings.

## PHASE 4 — MULTIMODAL DETECTIVE
Image analysis.
Video analysis.
Audio analysis.
OCR.
Maps.
Structured datasets.
Advanced timeline analysis.

## PHASE 5 — SPECIALIST AGENTS
Archivist.
Chronologist.
Cartographer.
Interview Analyst.
Source Analyst.
Contradiction Analyst.
Skeptic.
Verifier.
Hypothesis Engine.
Reporter.

## PHASE 6 — PROACTIVE DETECTIVE
Monitor authorised case information.
Detect material changes.
Alert investigator when evidence changes hypotheses, timelines, claims or unresolved questions.

## PHASE 7 — INVESTIGATIVE INTELLIGENCE PLATFORM
Cold cases.
Current cases.
Investigative journalism.
Documentary research.
Academic research.
Legal research.
Organisational investigations.
Broadcast/television workflows.

## Phase exit criteria (AUDIT ADDENDUM)
The phases above list scope but not a Definition of Done, so it's ambiguous when a phase is actually finished. §37 gives testing/acceptance criteria for the product as a whole but never maps them back to individual phases. Suggested exit criteria, using the vertical-slice rule from §0 and the security/testing requirements from §30 and §37:

- **Phase 0 done when:** a written architecture assessment exists covering stack, auth, database, storage, AI integrations, billing, routing and job infrastructure, plus an explicit decision on the greenfield-fallback question above if it applies.
- **Phase 1 done when:** the End-to-End test flow in §37 runs up to "DOSSIER BUILDS / EVIDENCE APPEARS" on real (not mocked) data for at least the demo case, and the mandatory security tests in §37 pass for Case/Evidence access.
- **Phase 2 done when:** a contradiction and a competing hypothesis generated by the system can each be traced to supporting/challenging evidence via the source-to-conclusion traceability described in §17, and an audit event exists for each.
- **Phase 3 done when:** a voice session can execute at least the command set in §16 end-to-end (recognise → interpret → act → navigate) with interruption handling working.
- **Phase 4 done when:** each multimodal capability (image/video/audio/OCR) produces evidence objects with the same provenance guarantees as text sources — no separate, lower-rigor code path for non-text media.
- **Phase 5 done when:** each specialist agent's output is attributable in the audit trail to that agent, and the Detective's synthesis step cannot silently drop an agent's dissenting finding (particularly the Skeptic's).
- **Phase 6 done when:** a material evidence change demonstrably triggers a re-evaluation of at least one affected hypothesis/claim/question, and the investigator is notified — not just logged.
- **Phase 7 is a scope expansion, not a single milestone** — treat each item (cold cases, current cases, broadcast, etc.) as independently shippable against the criteria already established in earlier phases, rather than requiring all of them before shipping any.

# 36. RECOMMENDED CLAUDE CODE BUILD ORDER
Inspect repository and produce architecture assessment.
Identify UNPAQUE shared primitives and do not duplicate them.
Create The Detective module boundary and route/navigation entry.
Create domain types/interfaces for Case, Dossier, Source, Media, Evidence, Claim, Person, Event, TimelineEvent, Statement, Question, Contradiction, Analysis, Investigation, Collaboration and AuditEvent.
Create database migrations/schema using existing UNPAQUE database conventions.
Implement case privacy and server-side authorization before exposing investigative data.
Implement Case + Dossier + Source + Evidence vertical slice.
Implement media/document viewer abstraction.
Implement timeline and entity relationships.
Build the desktop Investigative Console on real data.
Implement dossier assembly jobs and visible job states.
Implement source provenance and deduplication.
Implement claim/evidence separation.
Implement contradiction engine.
Implement hypothesis/falsification/skeptic engines.
Implement conversational command runtime over reusable application actions.
Implement source-to-conclusion traceability.
Implement collaboration and permissions.
Implement reporting/export abstraction.
Implement broadcast mode.
Add voice only after the visual investigative core is stable.
Add specialist agents behind provider/model abstractions.
Add proactive monitoring only after auditability and change detection are reliable.
Complete unit, integration, security and end-to-end tests.

# 37. TESTING AND ACCEPTANCE CRITERIA

## Unit tests
Evidence relationships
Claim classification
Timeline calculations
Permissions
Source deduplication
Dossier updates

## Integration tests
Research pipeline
Source ingestion
Transcription
Database relationships
Authentication
Collaboration

## End-to-end test
CREATE USER
  ↓
CREATE PRIVATE CASE
  ↓
SUBMIT INVESTIGATION QUESTION
  ↓
RESEARCH RUNS
  ↓
SOURCES APPEAR
  ↓
DOSSIER BUILDS
  ↓
EVIDENCE APPEARS
  ↓
USER INVESTIGATES
  ↓
COLLABORATOR INVITED
  ↓
COLLABORATOR ACCEPTS
  ↓
PERMISSIONS ENFORCED

## Mandatory security tests
User A cannot access User B's private case.
User A cannot access User B's private evidence.
User A cannot access User B's private notes.
Unaccepted collaborator cannot access case.
Viewer cannot edit.
Researcher cannot change owner permissions.
Published cases are public only when explicitly published.
Private cases remain private.
Guessing case IDs does not expose data.

## Product acceptance
User can create account through UNPAQUE.
User can create private case.
User can submit investigation question.
Dossier assembly is visible.
User can inspect sources, evidence, people, events and timeline.
User can open media and synchronized transcript.
User can examine claims.
User can compare sources.
User can see potential contradictions.
User can ask The Detective a question.
Detective answer can navigate the investigator to evidence.
User can invite collaborator.
Permissions are enforced.
At no point does the core experience feel like browsing a generic search engine.

# 38. DATA LIFECYCLE, RETENTION AND VERSIONING
All schema changes are versioned migrations.
Do not manually alter production schema.
Backups must exist before production launch.
Define retention policies for deleted cases, deleted accounts, media cache, source snapshots, audit logs and temporary research data.
Do not retain everything forever by default.
Account deletion must distinguish user-owned data, required financial records, security/audit records and shared collaborative content.
Source snapshots should preserve retrieved state where legally and technically appropriate.
If a source changes, record a new source version rather than silently treating the current page as identical to the historical version.

# 39. PRIVACY-PRESERVING PRODUCT ANALYTICS
cases_created
investigations_started
dossiers_completed
sources_processed
media_opened
evidence_viewed
timeline_used
collaboration_started
subscriptions
retention
Do not record sensitive investigative content merely because analytics can.

# 40. FUTURE-PROOFING PRINCIPLES
Technology will change. The stable primitives are:
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
The AI model is the intelligence engine. The methodology is the constitution. The evidence architecture is the memory. The investigator remains the human authority.

# 41. LONG-TERM PRODUCT / TELEVISION FLYWHEEL
TELEVISION SHOW
  ↓
AUDIENCE DISCOVERS THE DETECTIVE
  ↓
AUDIENCE SUBMITS CASES
  ↓
USERS BECOME INVESTIGATORS
  ↓
PRIVATE DOSSIERS ARE CREATED
  ↓
SELECTED CASES MAY BE SUBMITTED
  ↓
EDITORIAL TEAM REVIEWS
  ↓
PRODUCTION CASE CREATED WITH CONSENT
  ↓
TELEVISION INVESTIGATION
  ↓
NEW AUDIENCE
  ↓
NEW USERS
The television show is not merely content. It is the demonstration environment for the same underlying investigative machinery.

# 42. FINAL CLAUDE CODE DIRECTIVE
Do not reduce this vision to a chatbot. Do not reduce it to a search engine. Do not reduce it to a dashboard. Build the underlying investigative operating system as a feature inside UNPAQUE.
The ideal first serious release should allow a user to enter The Detective, create a private case, submit 'Investigate this', watch the dossier assemble, inspect sources and evidence, navigate a timeline, open media at relevant timestamps, compare claims and sources, see contradictions, ask the Detective questions, follow answers back to evidence, invite a collaborator, and maintain a complete audit trail.
The system should be confident about process, not unsupported conclusions.
When evidence is insufficient, the correct behaviour is to say so.
When the source cannot be retrieved, say so.
When accounts conflict, show the conflict.
When a hypothesis is weak, challenge it.
When a human must verify something, escalate it.
When the evidence supports a conclusion, show the path from conclusion → inference → evidence → original source.

## North-star experience
I am not talking to an AI.
I have another investigator in the room.
But underneath her personality is:
a rigorous evidence system,
an academic research methodology,
a skeptical reasoning engine,
persistent case memory,
multimodal intelligence,
and an auditable trail showing how every important conclusion was reached.

## Source basis
This master build specification consolidates the supplied documents: 'The Detective — Master System Build' (89 pages) and 'The Detective — Comprehensive Concept & Master Product Architecture' (44 pages). The source documents define the product concept, investigative constitution, evidence architecture, research orchestration, console, security, collaboration, broadcast model, subscriptions, provider abstraction, multi-agent architecture, phased development and prototype acceptance criteria.
