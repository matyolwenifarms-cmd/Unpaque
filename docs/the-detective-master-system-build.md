# The Detective — Master System Build

**This is a text extraction from a PDF, not the original document.** It is the
89-page source document that `THE_DETECTIVE_SPEC.md` says it consolidates —
and which that document's own audit note records as "not provided alongside
this specification". It was provided; it was in the project uploads and not in
the repository, which is the same thing as absent for anybody reading the code.

Two things to know before citing it:

1. **It is secondary.** Its own consolidated version says so: "If the source
   documents are later located, reconcile any conflicts in favour of this
   specification, since it is the one written specifically as an implementation
   brief." Use it for the reasoning behind a rule; use the consolidated spec
   for what the rule is.
2. **The section numbers do not match.** This document's numbering is its own —
   its §3 is the epistemic model, which the consolidated spec renumbers as §4.
   Every `§` citation in this repository refers to the **consolidated** spec.

The extraction was done with pdfjs-dist because the fonts are subset and
glyph-indexed, so the text is not recoverable by grep. Layout artefacts
survive: bullet glyphs collect at the end of a page rather than beside their
items, and page numbers appear as bare digits. Nothing has been reworded.

---



===== PAGE 1 =====
THE DETECTIVE

MASTER SYSTEM BUILD DOCUMENT

Global Investigative Media Intelligence Platform

0. INSTRUCTION TO CLAUDE

You are building THE DETECTIVE, a production-grade investigative media intelligence platform.

This is not a chatbot.

This is not a search engine.

This is not merely an AI research assistant.

This is not a conventional SaaS dashboard.

THE DETECTIVE is a system that allows a person to submit a case, question, claim, event, person, historical

mystery or unresolved issue and have the system construct a structured DOSSIER from publicly available

information and media.

The user then investigates that dossier through a cinematic investigative interface.

The system must be capable of eventually operating as:

A consumer subscription product.

A professional investigative research environment.

A collaborative investigation workspace.

A media-analysis engine.

A television/broadcast interface.

A public-facing investigative programme.

A global case-investigation platform.

The television product and consumer product must be built on the same underlying system.

The television show demonstrates the platform.

The platform allows viewers to become investigators themselves.

1.

2.

3.

4.

5.

6.

7.

1


===== PAGE 2 =====
1. THE CENTRAL PRODUCT IDEA

The core experience is:

CASE REQUEST

↓

RESEARCH

↓

SOURCE DISCOVERY

↓

SOURCE INGESTION

↓

MEDIA EXTRACTION

↓

TRANSCRIPTION

↓

ENTITY IDENTIFICATION

↓

CLAIM EXTRACTION

↓

EVENT EXTRACTION

↓

TIMELINE CONSTRUCTION

↓

SOURCE CROSS-REFERENCE

↓

CONTRADICTION DETECTION

↓

EVIDENCE GRAPH

↓

DOSSIER

↓

INVESTIGATIVE CONSOLE

↓

USER INVESTIGATION

The most important concept is:

The user does not search the internet. THE DETECTIVE searches, retrieves, organises and

presents the public record on the user's behalf.

The user experiences THE DETECTIVE.

External search providers, APIs and retrieval systems operate behind the system.

2


===== PAGE 3 =====
Do not expose Google, Bing or other search-engine branding as part of the core experience.

2. THE PRODUCT PHILOSOPHY

THE DETECTIVE operates according to one central principle:

DON'T JUST TELL ME. SHOW ME.

Whenever the system makes an analytical statement, the user should be able to inspect the underlying

evidence.

If THE DETECTIVE says:

"There are conflicting accounts of the date."

The interface should offer:

SHOW EVIDENCE

The user should then see the actual sources.

If THE DETECTIVE says:

"This person appears in three separate public accounts."

The user should be able to:

SHOW SOURCES

If THE DETECTIVE says:

"This statement was made at 01:42:17 in the video."

The system should be able to open the media at that timestamp.

3. THE DETECTIVE MUST DISTINGUISH FOUR

THINGS

The system must never casually collapse information into "truth".

3


===== PAGE 4 =====
Every important item should have an epistemic classification.

FACT

A directly supported factual observation from a source.

Example:

"Person X testified on 14 August."

CLAIM

Something a person or source asserts.

Example:

"Person X said that he met Person Y on Tuesday."

INFERENCE

A conclusion derived from multiple pieces of information.

Example:

"The available timeline suggests the meeting may have occurred earlier."

UNRESOLVED

The available public record does not allow the system to establish the answer.

This distinction must appear throughout the product.

Additional statuses:

CORROBORATED

PARTIALLY CORROBORATED

CONTESTED

CONTRADICTED

UNVERIFIED

DISPUTED

UNKNOWN

THE DETECTIVE must never convert uncertainty into certainty merely because an LLM generated a confident

answer.

•

•

•

•

•

•

•

4


===== PAGE 5 =====
4. PRIMARY PRODUCT OBJECTS

The database and application architecture should be built around these objects:

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

5. USER

A user account should contain:

ID

Name

Email

Avatar

Subscription tier

Account status

Created date

Last activity

Preferences

Locale

Timezone

Language

Usage limits

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

5


===== PAGE 6 =====
Do not unnecessarily collect personal information.

Privacy must be a first-class architectural concern.

6. CASE

A CASE is the user's investigative subject.

Examples:

"Investigate the disappearance of X."

"Investigate the events surrounding Y."

"Investigate this claim."

"Investigate the Madlanga Commission."

"Investigate 9/11."

"Investigate a historical mystery."

"Investigate a business controversy."

Case fields:

case_id

owner_id

title

description

original_question

status

created_at

updated_at

privacy_status

investigation_mode

jurisdiction

language

tags

Possible case statuses:

DRAFT

RESEARCHING

DOSSIER_ASSEMBLING

READY

ACTIVE_INVESTIGATION

•

•

•

•

•

•

•

6


===== PAGE 7 =====
PAUSED

ARCHIVED

Default privacy:

PRIVATE

7. DOSSIER

The DOSSIER is the central intellectual object of THE DETECTIVE.

A dossier is not simply a list of search results.

It is a structured representation of the public record surrounding a case.

A dossier contains:

CASE OVERVIEW

SOURCE REGISTER

MEDIA

DOCUMENTS

PEOPLE

ORGANISATIONS

LOCATIONS

EVENTS

TIMELINE

CLAIMS

STATEMENTS

EVIDENCE

CONTRADICTIONS

ANALYSIS

QUESTIONS

UNRESOLVED ISSUES

SOURCE RELATIONSHIPS

EVIDENCE RELATIONSHIPS

The dossier must be versioned.

Every significant update should be traceable.

7


===== PAGE 8 =====
8. DOSSIER VERSIONING

Never silently overwrite important investigative information.

A dossier should support versions:

DOSSIER v1.0

DOSSIER v1.1

DOSSIER v1.2

DOSSIER v2.0

The system should record:

What changed

When it changed

Why it changed

Which source caused the change

Which user initiated the change

Which AI process produced it

This creates an investigative audit trail.

9. SOURCE

A SOURCE is the origin of information.

Source types:

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

•

•

•

•

•

•

8


===== PAGE 9 =====
PUBLIC_DATABASE

ARCHIVE

OTHER

Each source should contain:

source_id

source_type

title

publisher

author

publication_date

retrieved_at

original_url

canonical_url

language

description

source_status

10. SOURCE PROVENANCE

Every extracted piece of information must maintain provenance.

If the system extracts:

"Meeting occurred on 14 June."

It must know:

CLAIM-031

↓

SOURCE-017

↓

DOCUMENT

↓

PAGE 42

Or:

CLAIM-031

↓

9


===== PAGE 10 =====
SOURCE-021

↓

VIDEO

↓

TIMESTAMP 01:42:17

Never create an orphaned AI statement with no source relationship.

11. MEDIA OBJECT

MEDIA is distinct from SOURCE.

A SOURCE may contain multiple media assets.

For example:

One news article may contain:

Article text

Photograph

Embedded video

Audio

Media fields:

media_id

source_id

media_type

storage_reference

external_reference

duration

dimensions

mime_type

thumbnail

transcription_status

processing_status

Media types:

VIDEO

AUDIO

IMAGE

PDF

•

•

•

•

10


===== PAGE 11 =====
DOCUMENT

WEBPAGE

12. MEDIA ABSTRACTION LAYER

Create a universal:

MediaViewer

component.

It must dynamically render:

VideoViewer

AudioViewer

ImageViewer

DocumentViewer

PdfViewer

WebViewer

TranscriptViewer

The central investigative screen must not assume every source is a video.

13. VIDEO CAPABILITY

The eventual system must support:

Public video URLs

Embedded video

Direct video files where legally/technically permitted

Timestamp targeting

Playback

Pause

Scrubbing

Relevant segment marking

Transcript synchronization

Source metadata

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

11


===== PAGE 12 =====
SOURCE 014

PUBLIC TESTIMONY

RELEVANT SEGMENT

01:42:17 → 01:44:02

The UI should allow:

PLAY SEGMENT

and eventually open the media at the correct timestamp.

14. AUDIO CAPABILITY

Audio must support:

Playback

Pause

Scrubbing

Waveform

Transcript

Timestamp navigation

Speaker identification where technically possible

Relevant segment highlighting

15. IMAGE CAPABILITY

Photographs must support:

Fullscreen

Zoom

Metadata

Source attribution

Caption

Date

Relevant case relationship

The user should be able to say:

"Show me the photograph."

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

12


===== PAGE 13 =====
The Detective should display it in the central media window.

16. DOCUMENT CAPABILITY

Documents must support:

PDF viewing

Page navigation

Text extraction

Search

Highlighting

Source attribution

Page references

Relevant passage extraction

17. TRANSCRIPTION ENGINE

For video/audio sources, create a transcription pipeline.

Pipeline:

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

Transcript entries should have:

speaker

start_time

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
end_time

text

confidence

The transcript must remain linked to the original media.

18. ENTITY EXTRACTION

The system should identify:

People

Organisations

Places

Events

Dates

Documents

Institutions

Products

Vehicles

Locations

Other meaningful entities

Every entity should become a structured object where appropriate.

19. PEOPLE GRAPH

People should be represented as nodes.

A person can connect to:

Events

Claims

Statements

Sources

Documents

Locations

Organisations

Evidence

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

•

•

•

•

•

14


===== PAGE 15 =====
PERSON

MOGOTSI

↓ appears in

13 EVENTS

8 STATEMENTS

47 SOURCES

3 DOCUMENTS

20. EVENT ENGINE

Identify events from sources.

Each event should have:

event_id

date

time

location

description

people

sources

confidence

status

Events must be linked to sources.

21. TIMELINE ENGINE

The system should automatically construct a timeline from identified events.

Timeline should distinguish:

Confirmed dates

Claimed dates

Approximate dates

Conflicting dates

Unknown dates

•

•

•

•

•

15


===== PAGE 16 =====
Example:

14 JUNE

|

|--- Source 014: Meeting allegedly occurred

|

|--- Source 027: Meeting described differently

|

|--- Source 031: No meeting mentioned

22. CLAIM ENGINE

A CLAIM is something that needs examination.

Example:

CLAIM-038

"Person X met Person Y on 14 June."

SUPPORTED BY:

SOURCE 014

CHALLENGED BY:

SOURCE 027

STATUS:

CONTESTED

The system must distinguish:

Claim from Evidence supporting the claim.

23. CONTRADICTION ENGINE

Create a dedicated contradiction detection system.

It should look for:

Different dates•

16


===== PAGE 17 =====
Different locations

Different sequences

Different descriptions

Different statements

Conflicting names

Conflicting numbers

Conflicting accounts

But never automatically label something a contradiction merely because wording differs.

Use:

POTENTIAL CONTRADICTION

until verified.

24. SOURCE COMPARISON

The Detective must be able to compare multiple sources.

Example:

SOURCE 014

01:42:17

STATEMENT A

VS

SOURCE 027

08:17

STATEMENT B

Show:

Common facts

Differences

Missing information

Potential contradiction

Context

Dates

Source provenance

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

17


===== PAGE 18 =====
25. EVIDENCE OBJECT

Evidence is not synonymous with source.

A single source can contain multiple evidence items.

Example:

SOURCE 014

↓

EVIDENCE 001

EVIDENCE 002

EVIDENCE 003

Evidence fields:

evidence_id

source_id

media_id

type

description

timestamp

page

status

confidence

related_claims

related_people

related_events

26. EVIDENCE CLASSIFICATION

Use:

PRIMARY

CORROBORATING

SECONDARY

CONTEXTUAL

CLAIM

UNVERIFIED

18


===== PAGE 19 =====
DISPUTED

CONTRADICTORY

UNRESOLVED

The interface must visually distinguish these.

27. INVESTIGATION ENGINE

The user should be able to interrogate the dossier.

Examples:

"What happened before the meeting?"

"Show me every source mentioning this person."

"What are the conflicting accounts?"

"Build the timeline."

"What evidence supports this claim?"

"What evidence contradicts it?"

"Show me the testimony."

"Play the relevant section."

"What remains unknown?"

"Who first made this allegation?"

"Find all statements made by Person X about Person Y."

The Detective should answer by navigating the dossier, not merely generating text.

28. COMMAND-DRIVEN INVESTIGATION

Create a command/action system.

Possible commands:

19


===== PAGE 20 =====
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

These commands should become reusable application actions.

29. THE DETECTIVE PERSONALITY

THE DETECTIVE should sound intelligent, calm and precise.

Avoid:

Overly theatrical language

Fake certainty

Sensationalism

"I have uncovered the truth!"

Conspiracy-style language

Preferred language:

"I found three relevant sources."

"These accounts differ."

"The available evidence does not establish this."

"There is a potential inconsistency."

"Let's examine the source."

"I need more evidence."

•

•

•

•

•

20


===== PAGE 21 =====
"This remains unresolved."

The Detective is confident about process, not about unsupported conclusions.

30. RESEARCH ORCHESTRATOR

Build a backend research orchestration layer.

The system should be provider-agnostic.

Do not hard-code the product to a single search engine.

Create interfaces such as:

SearchProvider

NewsProvider

VideoProvider

ArchiveProvider

DocumentProvider

WebRetrievalProvider

Then implement providers independently.

Future providers can be added without rewriting the application.

31. RESEARCH PIPELINE

When a new case begins:

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

21


===== PAGE 22 =====
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

32. QUERY DECOMPOSITION

The Detective should not perform one giant search.

Break the case into research questions.

Example:

User:

"Investigate the disappearance of Person X."

Research plan:

WHO IS PERSON X?

WHEN DID THE DISAPPEARANCE OCCUR?

WHERE DID IT OCCUR?

WHO WAS INVOLVED?

WHAT WAS PUBLICLY REPORTED?

WHAT DID AUTHORITIES SAY?

WHAT DID WITNESSES SAY?

WHAT DOCUMENTS EXIST?

WHAT MEDIA EXISTS?

WHAT TIMELINE CAN BE ESTABLISHED?

22


===== PAGE 23 =====
WHAT CLAIMS ARE DISPUTED?

WHAT REMAINS UNKNOWN?

This creates a structured research process.

33. SOURCE DISCOVERY

Search multiple independent source categories.

Do not rely on a single source.

Prioritize:

Primary documents

Official records

Direct testimony

Original video/audio

Reputable reporting

Secondary reporting

Archives

Other public material

The source hierarchy should be configurable.

34. SOURCE DEDUPLICATION

The same story may appear on dozens of websites.

Do not treat:

50 websites repeating the same wire story

as:

50 independent sources.

Create source lineage.

Example:

1.

2.

3.

4.

5.

6.

7.

8.

23


===== PAGE 24 =====
ORIGINAL REPORT

↓

REPUBLICATION A

↓

REPUBLICATION B

↓

REPUBLICATION C

The system should recognise probable duplication/syndication.

35. SOURCE DIVERSITY

The dossier should show:

PRIMARY SOURCES

SECONDARY SOURCES

INDEPENDENT SOURCES

REPUBLICATIONS

The Detective should be able to say:

"This claim appears in 14 articles, but most appear to derive from the same original report."

This is extremely important.

36. SOURCE QUALITY

Create a source-quality framework.

Possible factors:

Proximity to event

Primary vs secondary

Author identification

Publication date

Corroboration

Originality

Editorial transparency

Document provenance

Direct quotation

•

•

•

•

•

•

•

•

•

24


===== PAGE 25 =====
Independent confirmation

Do not reduce source quality to one simplistic number.

Use explainable indicators.

37. DOSSIER ASSEMBLY EXPERIENCE

When research begins, enter:

DOSSIER ASSEMBLY

Display:

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

At completion:

•

25


===== PAGE 26 =====
DOSSIER READY

38. INVESTIGATIVE CONSOLE

The main interface should have:

┌──────────────────────────────────────────────────────────────┐

│ THE DETECTIVE CASE 001 ● ONLINE │

├───────────────┬──────────────────────────────┬───────────────┤

│ CASE │ │ EVIDENCE │

│ OVERVIEW │ │ │

│ TIMELINE │ MEDIA WINDOW │ E-001 │

│ PEOPLE │ │ E-002 │

│ LOCATIONS │ │ E-003 │

│ CLAIMS │ │ E-004 │

│ EVIDENCE │ │ │

│ SOURCES │ │ │

│ DOCUMENTS │ │ │

│ MEDIA │ │ │

├───────────────┴──────────────────────────────┴───────────────┤

│ TRANSCRIPT │ SOURCE │ ANALYSIS │ QUESTIONS │

├──────────────────────────────────────────────────────────────┤

│ DETECTIVE │

│ Three sources contain relevant statements. │

│ │

│ [SHOW EVIDENCE] [COMPARE SOURCES] [BUILD TIMELINE] │

└──────────────────────────────────────────────────────────────┘

This is the core product UI.

39. CASE NAVIGATION

Left navigation:

OVERVIEW

TIMELINE

PEOPLE

ORGANISATIONS

LOCATIONS

26


===== PAGE 27 =====
CLAIMS

EVIDENCE

SOURCES

MEDIA

DOCUMENTS

QUESTIONS

CONTRADICTIONS

ANALYSIS

40. CENTRAL MEDIA WINDOW

This is the visual heart of the system.

It must dynamically display:

Video

Audio

Image

Document

PDF

Web content

Transcript

Timeline

Evidence comparison

The media window must be reusable and stateful.

41. RIGHT EVIDENCE PANEL

Display:

EVIDENCE

E-001

PUBLIC TESTIMONY

SOURCE 014

01:42:17

E-002

NEWS REPORT

SOURCE 021

08:13

•

•

•

•

•

•

•

•

•

27


===== PAGE 28 =====
E-003

PHOTOGRAPH

SOURCE 037

E-004

DOCUMENT

PAGE 42

Clicking an evidence item changes the main media view.

42. LOWER INTELLIGENCE PANEL

Tabs:

TRANSCRIPT

SOURCE

ANALYSIS

QUESTIONS

Transcript must synchronize with media.

43. BROADCAST MODE

Create:

BROADCAST MODE

When enabled:

Remove unnecessary controls

Enlarge central media

Reduce navigation

Increase readability

Show source identifiers

Show evidence numbers

Show timestamps

Show Detective analysis

Use broadcast-safe layouts

Target:

•

•

•

•

•

•

•

•

•

28


===== PAGE 29 =====
1920 × 1080

16:9

The system should look excellent when captured or displayed during a television programme or YouTube

broadcast.

44. BROADCAST SCENARIO

Example:

HOST:

"Detective, show us the testimony."

SYSTEM:

SOURCE 014

PUBLIC TESTIMONY

01:42:17

Media loads.

HOST:

"Pause."

Video pauses.

HOST:

"What did he say immediately before that?"

Detective navigates transcript.

HOST:

"Compare that with his earlier statement."

System splits the screen.

29


===== PAGE 30 =====
SOURCE 014

VS

SOURCE 027

This is a core use case.

45. VIEWER CASE SUBMISSION

Create:

GIVE THE DETECTIVE A CASE

Input:

Describe the case, person, event, claim or mystery you want investigated...

Button:

BEGIN INVESTIGATION

The submission becomes a private case owned by the user.

46. CASE PRIVACY

This is NON-NEGOTIABLE.

Every case is private by default.

A user's case must NOT automatically become public.

No public dossier URLs by default.

No public case directory by default.

No automatic social sharing.

No automatic publication.

30


===== PAGE 31 =====
No automatic inclusion in television.

47. COLLABORATION

Cases can become collaborative only through explicit consent.

Permissions:

OWNER

INVESTIGATOR

EDITOR

RESEARCHER

VIEWER

Possible future permissions:

COMMENTER

SOURCE_CONTRIBUTOR

ANALYST

Collaboration process:

OWNER

↓

INVITATION

↓

RECIPIENT ACCEPTS

↓

ACCESS GRANTED

Never grant access merely because someone has a link.

48. SHARING VS COLLABORATION

These must be separate concepts.

PRIVATE

INVITE COLLABORATOR

31


===== PAGE 32 =====
VIEW ONLY

EDIT

PUBLISH

A user should explicitly choose what they are doing.

49. PUBLISHING

Publishing must be an explicit action.

Before publication:

PUBLISH DOSSIER

Publishing this dossier may expose:

- Investigation notes

- Sources

- Evidence

- Analysis

- Questions

- Case history

Are you sure?

CANCEL

PUBLISH

Publishing should require confirmation.

50. PRIVATE NOTES

Users may maintain private notes.

Private notes must remain separate from:

Public evidence

AI-generated analysis

Shared collaborator notes

A private note must never accidentally appear in broadcast mode or shared mode.

•

•

•

32


===== PAGE 33 =====
51. AUDIT LOG

Every important action should be logged.

Examples:

CASE CREATED

SOURCE ADDED

SOURCE REMOVED

EVIDENCE CREATED

EVIDENCE MODIFIED

NOTE CREATED

NOTE EDITED

COLLABORATOR INVITED

COLLABORATOR ACCEPTED

PERMISSION CHANGED

DOSSIER UPDATED

CASE PUBLISHED

CASE ARCHIVED

52. SECURITY MODEL

Use strong server-side authorization.

Never rely exclusively on frontend hiding.

Every request must verify:

USER

CASE OWNERSHIP

COLLABORATION PERMISSION

RESOURCE ACCESS

Use row-level security where supported by the database architecture.

Private cases must be inaccessible to unauthorized users even if someone guesses an ID.

33


===== PAGE 34 =====
53. INVESTIGATION HISTORY

Maintain an investigation history.

Show:

YOU ASKED

THE DETECTIVE SEARCHED

SOURCES FOUND

EVIDENCE ADDED

ANALYSIS PRODUCED

DOSSIER UPDATED

This creates reproducibility.

54. AI ANALYSIS PROVENANCE

Every AI-generated analytical statement should store:

Model

Timestamp

Prompt/context identifier

Source IDs used

Evidence IDs used

Dossier version

Confidence/status

Human modifications if any

The system should be able to answer:

"Why did you say that?"

with the actual supporting evidence chain.

55. NO HALLUCINATED EVIDENCE

This is one of the strongest rules in the entire project.

THE DETECTIVE must never:

Invent a source

•

•

•

•

•

•

•

•

•

34


===== PAGE 35 =====
Invent a quote

Invent a timestamp

Invent a document

Invent a photograph

Invent testimony

Invent an event

Pretend to have retrieved something it did not retrieve

If evidence is unavailable:

I don't have sufficient evidence to establish that.

56. QUOTE HANDLING

Quotes must remain tied to their source.

Store:

quote

source_id

timestamp/page

speaker

context

Do not generate fake verbatim quotations from summaries.

57. SEARCH RESULTS ARE NOT THE DOSSIER

Search results are temporary research material.

The dossier contains validated/relevant structured information.

Pipeline:

SEARCH RESULT

↓

SOURCE RETRIEVAL

↓

CONTENT PROCESSING

↓

RELEVANCE EVALUATION

•

•

•

•

•

•

•

35


===== PAGE 36 =====
↓

SOURCE RECORD

↓

EVIDENCE/CLAIM/EVENT

↓

DOSSIER

58. RESEARCH CACHE

Avoid repeatedly retrieving the same source.

Create a source cache.

Store:

URL

Retrieval date

Content hash

Metadata

Parsed text

Media references

Processing status

If source has changed, record a new version.

59. SOURCE SNAPSHOTS

Where legally and technically appropriate, preserve a reference to the retrieved state of the source.

Do not imply that a current webpage is identical to an older version.

Record:

FIRST RETRIEVED

LAST VERIFIED

SOURCE UPDATED

•

•

•

•

•

•

•

36


===== PAGE 37 =====
60. GLOBAL ARCHITECTURE

Build the system in modular layers.

Suggested architecture:

/apps

/web

/broadcast

/admin

/packages

/ui

/database

/types

/media

/research

/dossier

/evidence

/timeline

/ai

/auth

/security

/analytics

/services

/research-orchestrator

/media-processing

/transcription

/document-processing

/dossier-engine

/evidence-engine

Do not blindly follow this exact folder structure if a better architecture is appropriate.

The principle is modularity.

61. FRONTEND

Use a modern component-based frontend.

37


===== PAGE 38 =====
Priorities:

Fast

Responsive

Accessible

Keyboard-friendly

Modular

State-aware

Media-capable

Build reusable components.

Do not create one giant page component.

62. BACKEND

Use a service-oriented backend where appropriate.

Separate:

AUTH

CASE MANAGEMENT

RESEARCH

SOURCE MANAGEMENT

MEDIA

DOSSIER

EVIDENCE

AI

COLLABORATION

BILLING

AUDIT

63. DATABASE

Design relational structures for:

Users

Cases

Dossiers

Sources

Media

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

38


===== PAGE 39 =====
Evidence

Claims

People

Events

Statements

Questions

Collaborators

Permissions

Audit events

Use relational integrity.

Use graph-like relationships through join tables rather than forcing everything into one JSON blob.

JSON can be used for flexible metadata.

64. EVIDENCE GRAPH

Create relationships such as:

PERSON → EVENT

PERSON → SOURCE

PERSON → CLAIM

PERSON → STATEMENT

SOURCE → EVIDENCE

SOURCE → CLAIM

SOURCE → EVENT

CLAIM → EVIDENCE

CLAIM → CONTRADICTION

EVENT → TIMELINE

EVENT → SOURCE

DOCUMENT → EVIDENCE

MEDIA → EVIDENCE

The graph should eventually be visualisable.

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
65. GRAPH VIEW

Create a future/initial graph view:

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

Users can click nodes.

66. QUESTIONS ENGINE

Every investigation should have unanswered questions.

Example:

UNRESOLVED QUESTIONS

Q-001

Who was present at the meeting?

Q-002

Why do two sources provide different dates?

Q-003

What happened between Event A and Event B?

The Detective can attempt to answer them.

40


===== PAGE 41 =====
If unable:

UNRESOLVED

67. RESEARCH EXPANSION

The user can say:

"Expand the investigation."

The system should:

Review existing dossier.

Identify gaps.

Generate additional research questions.

Search for new sources.

Compare newly found sources.

Update dossier.

Highlight what changed.

68. CHANGE DETECTION

If the dossier changes, show:

DOSSIER UPDATE

3 NEW SOURCES

2 NEW EVENTS

1 NEW CLAIM

1 PREVIOUSLY UNRESOLVED QUESTION UPDATED

This makes the dossier feel alive.

1.

2.

3.

4.

5.

6.

7.

41


===== PAGE 42 =====
69. LIVE DOSSIER ASSEMBLY

The dossier should eventually be assembled in real time.

The user should see:

SOURCE FOUND

SOURCE INDEXED

RELEVANT PASSAGE IDENTIFIED

PERSON IDENTIFIED

EVENT IDENTIFIED

CLAIM IDENTIFIED

RELATIONSHIP CREATED

This is both a UX feature and a broadcast opportunity.

70. SUBSCRIPTION SYSTEM

THE DETECTIVE should be designed as a subscription product.

Do not hard-code pricing.

Create configurable plans.

Possible plans:

FREE

INVESTIGATOR

PRO

PROFESSIONAL

Capabilities should be entitlement-based.

Examples:

max_active_cases

monthly_research_units

media_processing

dossier_size

collaboration

42


===== PAGE 43 =====
export

advanced_analysis

71. CREDIT/USAGE SYSTEM

Research and media processing can become expensive.

Build a usage accounting layer.

Track:

research_units

transcription_units

document_processing_units

AI_units

media_processing_units

storage

Do not directly tie the entire architecture to a single provider's pricing.

72. BILLING ABSTRACTION

Create:

BillingProvider

so the system can support a payment provider without contaminating business logic.

73. PROFESSIONAL USERS

Design for:

Journalists

Researchers

Documentary filmmakers

Lawyers

Academics

•

•

•

•

•

43


===== PAGE 44 =====
Investigators

Students

Newsrooms

Production companies

Professional workflows may eventually include:

Export dossier

Export evidence list

Export timeline

Export source register

PDF report

Research package

Collaboration

Case handover

74. TELEVISION PRODUCT

THE DETECTIVE should support a television format.

A host can operate the console live.

The host should be able to say:

"Detective, show me the testimony."

"Compare these statements."

"Show me the photograph."

"What happened next?"

"Build the timeline."

"What remains unresolved?"

The UI should support keyboard shortcuts and eventually voice control.

75. VOICE INTERFACE

Future voice layer:

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

44


===== PAGE 45 =====
HOST SPEECH

↓

SPEECH TO TEXT

↓

COMMAND INTERPRETATION

↓

INVESTIGATION ACTION

↓

MEDIA NAVIGATION

Examples:

"Open source fourteen."

"Play from one forty-two."

"Pause."

"Show the photograph."

"Compare with the previous statement."

"Go back to the timeline."

76. VOICE RESPONSE

The Detective can eventually respond by voice.

But the visual interface remains primary.

Voice should control the system, not replace the visual evidence.

77. TELEVISION GRAPHICS

Broadcast mode should eventually expose a graphics layer.

Potential overlays:

SOURCE 014

PUBLIC TESTIMONY

45


===== PAGE 46 =====
EVIDENCE E-031

01:42:17

Lower-third:

THE DETECTIVE

CASE 001

Contradiction indicator:

POTENTIAL CONTRADICTION

78. GLOBALISATION

The system must be international from the beginning.

Support:

Multiple languages

Local dates

Local time zones

Character encoding

Translation

Local source providers

Regional search

Jurisdiction

Source language

Do not design around South Africa only.

South Africa may be the initial market, but the architecture must support global cases.

79. INTERNATIONAL CASES

A case can originate anywhere.

Examples:

•

•

•

•

•

•

•

•

•

46


===== PAGE 47 =====
USA

UK

SOUTH AFRICA

INDIA

BRAZIL

NIGERIA

JAPAN

AUSTRALIA

The system should not assume one legal system or media environment.

80. JURISDICTION

Cases should optionally specify jurisdiction.

Example:

COUNTRY

REGION

CITY

COURT/JURISDICTION

This helps research.

81. LEGAL/ETHICAL GUARDRAILS

The Detective must distinguish:

PUBLIC INFORMATION

ALLEGATION

CLAIM

EVIDENCE

CONVICTION

ACQUITTAL

DISPUTED ACCOUNT

UNVERIFIED INFORMATION

Never state an allegation as established fact.

47


===== PAGE 48 =====
Never infer guilt from association.

Never fabricate evidence.

Never encourage harassment.

Never expose private information merely because it can be found.

82. SENSITIVE INFORMATION

The platform must be designed to handle sensitive material responsibly.

The system should have mechanisms to flag:

Personal addresses

Phone numbers

Email addresses

Financial information

Medical information

Minors

Sexual information

Private communications

Other sensitive personal information

Such information should not automatically become prominent evidence.

83. PUBLIC RECORD DOES NOT MEAN UNLIMITED

USE

The architecture should distinguish:

SOURCE IS PUBLIC

from:

WE MAY REDISTRIBUTE THIS CONTENT

Media embedding, caching, downloading, transcription and display must respect applicable rights, licences

and provider terms.

•

•

•

•

•

•

•

•

•

48


===== PAGE 49 =====
Do not build an architecture that assumes all publicly accessible media can simply be copied into

permanent storage.

Where appropriate, reference or embed the original media rather than duplicating it.

84. SOURCE ATTRIBUTION

Every source display should provide attribution.

Example:

SOURCE 014

Public Testimony

Publisher / Origin

Published:

14 August 2026

Original source:

[OPEN ORIGINAL]

The Detective's UI remains primary.

85. SEARCH ENGINE BRANDING

Do not display search-engine branding as part of the user experience unless required by an API/provider's

terms.

The user sees:

THE DETECTIVE

RESEARCHING PUBLIC RECORD

not:

GOOGLE SEARCH

49


===== PAGE 50 =====
86. ADMIN CONSOLE

Create an administrative system.

Admin should manage:

Users

Cases where authorized

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

87. JOB QUEUE

Long-running work should use background jobs.

Examples:

CASE_RESEARCH

SOURCE_RETRIEVAL

VIDEO_PROCESSING

TRANSCRIPTION

DOCUMENT_EXTRACTION

ENTITY_EXTRACTION

TIMELINE_BUILD

DOSSIER_UPDATE

Never make the browser wait for everything synchronously.

88. JOB STATUS

Users should see:

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

50


===== PAGE 51 =====
QUEUED

PROCESSING

COMPLETED

FAILED

RETRYING

89. FAILURE HANDLING

If a source cannot be accessed:

SOURCE UNAVAILABLE

Do not pretend it was processed.

If transcription fails:

TRANSCRIPTION FAILED

If a source disappears:

SOURCE NO LONGER AVAILABLE

Preserve historical metadata where appropriate.

90. OBSERVABILITY

Track:

Research jobs

Processing jobs

API errors

AI errors

Retrieval failures

Database errors

Media failures

Authentication failures

Permission violations

Create structured logs.

•

•

•

•

•

•

•

•

•

51


===== PAGE 52 =====
91. SECURITY AUDITING

Log sensitive operations.

Especially:

Case access

Permission changes

Collaborator additions

Source deletion

Case publication

Export

Administrative access

92. TESTING STRATEGY

Create tests for:

UNIT

Evidence relationships

Claim classification

Timeline calculations

Permissions

Source deduplication

Dossier updates

INTEGRATION

Research pipeline

Source ingestion

Transcription

Database relationships

Authentication

Collaboration

END-TO-END

Example:

Create user

↓

Create case

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

52


===== PAGE 53 =====
↓

Submit research question

↓

Research runs

↓

Sources appear

↓

Dossier builds

↓

Evidence appears

↓

User investigates

↓

Collaborator invited

↓

Collaborator accepts

↓

Permissions enforced

93. SECURITY TESTS

Explicitly test:

User A cannot access User B's private case.

User A cannot access User B's private evidence.

User A cannot access User B's private notes.

Unaccepted collaborator cannot access case.

Viewer cannot edit.

Researcher cannot change owner permissions.

Published cases are intentionally public only if explicitly published.

Private cases remain private.

Guessing case IDs does not expose data.

94. ACCESSIBILITY

The interface must support:

Keyboard navigation

Screen readers where practical

Focus states

Sufficient contrast

Captions

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

53


===== PAGE 54 =====
Transcript access

Accessible controls

Broadcast aesthetics must never compromise usability.

95. PERFORMANCE

Priorities:

Fast initial load

Lazy loading

Virtualized long lists

Progressive media loading

Cached metadata

Background processing

Efficient database queries

Large dossiers should not crash the browser.

96. DOSSIER SCALE

The architecture should eventually support:

thousands of sources

thousands of evidence items

hundreds of people

thousands of events

large transcripts

multiple media assets

Do not build assuming a dossier contains ten sources.

97. SEARCH INSIDE DOSSIER

The user should be able to search their dossier.

Search:

People

Claims

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

54


===== PAGE 55 =====
Sources

Evidence

Transcript

Events

Documents

This is different from external research.

98. DOSSIER FILTERS

Filters:

SOURCE TYPE

DATE

PERSON

EVENT

CLAIM

EVIDENCE TYPE

STATUS

CONFIDENCE

MEDIA TYPE

99. INVESTIGATION BOOKMARKS

Users can bookmark:

Evidence

Sources

Timeline events

Statements

Media timestamps

Questions

Example:

MY INVESTIGATION

BOOKMARK 001

SOURCE 014

01:42:17

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

55


===== PAGE 56 =====
100. INVESTIGATIVE WORKSPACE

Allow users to create a temporary working board.

Drag:

Evidence

People

Events

Sources

Claims

into the workspace.

This is the user's investigative desk.

101. CASE MAP

Eventually provide a geographical map.

If a case contains locations:

EVENT A

CAPE TOWN

EVENT B

JOHANNESBURG

EVENT C

LONDON

Clicking a location shows relevant events and sources.

102. SOURCE CHAIN

Create a source lineage view.

Example:

•

•

•

•

•

56


===== PAGE 57 =====
ORIGINAL DOCUMENT

↓

NEWS REPORT

↓

INTERVIEW

↓

SECONDARY ARTICLE

↓

SOCIAL MEDIA POST

This allows the Detective to identify when supposedly independent reporting may originate from one

source.

103. CLAIM CHAIN

Likewise:

ORIGINAL CLAIM

↓

REPORTING

↓

REPUBLICATION

↓

COMMENTARY

↓

SOCIAL MEDIA

The Detective can tell the user:

"This claim appears repeatedly, but the available sources trace back to the same original

report."

104. MEDIA SEGMENTS

A video or audio source may contain multiple relevant segments.

Represent:

SOURCE 014

57


===== PAGE 58 =====
SEGMENT 001

00:13:12

SEGMENT 002

01:42:17

SEGMENT 003

02:04:31

Each segment can become evidence.

105. MEDIA BOOKMARKS

Allow the user to bookmark exact timestamps.

SOURCE 014

01:42:17

USER NOTE:

Important statement.

106. CASE EXPORT

Future export formats:

PDF DOSSIER

SOURCE REGISTER

TIMELINE

EVIDENCE REPORT

RESEARCH NOTES

Exports must respect permissions and privacy.

107. COLLABORATIVE INVESTIGATION

When collaboration is enabled:

58


===== PAGE 59 =====
CASE OWNER

COLLABORATORS

Sarah — Researcher

John — Viewer

Mike — Editor

Each collaborator sees only what their permission allows.

108. COLLABORATION COMMENTS

Future feature:

Users can comment on:

Evidence

Sources

Claims

Timeline events

Example:

"I think this source contradicts E-017."

Comments should be associated with the object being discussed.

109. EDITORIAL WORKSPACE

For the television production team, create a separate editorial workspace.

A private user case can be submitted for consideration.

Editorial team may:

REVIEW

DUPLICATE

REQUEST ACCESS

CREATE PRODUCTION CASE

REJECT

•

•

•

•

59


===== PAGE 60 =====
Never automatically expose the user's private case.

110. PRODUCTION CASE

A production case is separate from the user's private case.

This protects the original user investigation.

Possible relationship:

USER CASE

↓

EDITORIAL SUBMISSION

↓

PRODUCTION CASE

The production case can contain selected material from the user's case with explicit permission.

111. TELEVISION EPISODE MODEL

Eventually:

EPISODE

↓

PRODUCTION CASE

↓

DOSSIER

↓

EVIDENCE

↓

MEDIA

↓

SCRIPT / RUN OF SHOW

112. LIVE INVESTIGATION

Future live mode:

60


===== PAGE 61 =====
HOST

↓

VOICE COMMAND

↓

DETECTIVE

↓

CASE

↓

MEDIA

The system should be able to respond quickly enough for live production.

113. USER EXPERIENCE LOOP

The consumer experience should be:

WATCH THE DETECTIVE

↓

BECOME CURIOUS

↓

SUBMIT A CASE

↓

DOSSIER ASSEMBLES

↓

INVESTIGATE

↓

SAVE CASE

↓

OPTIONALLY COLLABORATE

The television programme becomes the demonstration of the product.

114. THE GLOBAL MEDIA PRODUCT

THE DETECTIVE must not be architected as a South African-only product.

The initial brand may emerge from South Africa.

61


===== PAGE 62 =====
But the product must support:

International users

International sources

International languages

International cases

International collaborators

International media

Regional research providers

115. EXAMPLE CASES

The system should theoretically handle cases such as:

"Investigate the disappearance of X."

"Investigate the Madlanga Commission."

"Investigate this historical murder."

"Investigate this political scandal."

"Investigate this corporate controversy."

"Investigate this viral claim."

"Investigate the public record surrounding 9/11."

"Investigate this unexplained event."

The system should not assume the user's premise is correct.

The case question is the starting point for investigation, not the conclusion.

116. THE 9/11 EXAMPLE

If a user submits:

"Detective, investigate 9/11 again. Something is fishy."

The system must NOT begin with:

•

•

•

•

•

•

•

62


===== PAGE 63 =====
"Here is why the conspiracy is true."

Instead:

CASE RECEIVED

QUESTION:

What claims or unresolved questions surround the events of 9/11?

BUILDING DOSSIER

PRIMARY SOURCES

OFFICIAL RECORDS

COURT RECORDS

TESTIMONY

VIDEO

PHOTOGRAPHS

NEWS ARCHIVES

ACADEMIC SOURCES

OTHER PUBLIC MATERIAL

Then identify individual claims.

For each claim:

CLAIM

SOURCE

SUPPORTING EVIDENCE

CONTRADICTING EVIDENCE

STATUS

UNRESOLVED QUESTIONS

The system investigates the claim.

It does not assume the user's conclusion.

117. NO CONSPIRACY ENGINE

Do not build a "conspiracy detector" or "conspiracy confirmation" system.

Build a:

63


===== PAGE 64 =====
CLAIM INVESTIGATION ENGINE

This protects the integrity of the product.

118. THE DETECTIVE SHOULD BE ABLE TO SAY NO

Examples:

"I cannot verify that."

"The evidence currently available does not support that conclusion."

"This appears to originate from one source."

"I found no reliable evidence supporting that claim."

"There are conflicting accounts."

This is a strength, not a weakness.

119. RESEARCH TRANSPARENCY

The user should be able to inspect:

WHAT WAS SEARCHED

WHAT WAS FOUND

WHAT WAS INCLUDED

WHAT WAS EXCLUDED

WHY IT WAS INCLUDED

Do not reveal proprietary provider mechanics unnecessarily, but provide enough transparency to

understand dossier construction.

120. RESEARCH LOG

Every investigation has:

64


===== PAGE 65 =====
RESEARCH LOG

08:31

Research started.

08:32

17 sources discovered.

08:34

5 sources retrieved.

08:37

3 video sources identified.

08:40

Transcript extraction complete.

08:43

Potential contradiction detected.

121. SYSTEM STATES

The Detective should have clear states:

IDLE

LISTENING

RESEARCHING

ASSEMBLING DOSSIER

PROCESSING MEDIA

ANALYSING

READY

INVESTIGATING

WAITING

ERROR

The interface should reflect these.

122. BRAND EXPERIENCE

The system should feel:

65


===== PAGE 66 =====
INTELLIGENT

SERIOUS

CINEMATIC

CURIOUS

PRECISE

CALM

POWERFUL

TRUSTWORTHY

Not:

CHEESY

PARANOID

HACKER

CONSPIRACY THEMED

GAMIFIED

GENERIC AI

123. THE "YOU ARE NOT SUPPOSED TO BE

WATCHING" LINE

The existing concept:

YOU ARE NOT SUPPOSED TO BE WATCHING

may be retained as a cinematic opening/activation sequence.

It should not define the entire product.

Possible activation:

THE DETECTIVE

YOU ARE NOT SUPPOSED TO BE WATCHING

[ SYSTEM INITIALISING ]

PUBLIC RECORD ACCESS

MEDIA ARCHIVE

EVIDENCE ENGINE

66


===== PAGE 67 =====
DOSSIER ENGINE

SYSTEM ONLINE

Then:

GIVE THE DETECTIVE A CASE.

124. FIRST-RUN EXPERIENCE

New user:

WELCOME TO THE DETECTIVE

You don't search.

You investigate.

Give The Detective a case.

Input:

What should we investigate?

Button:

BEGIN

125. PRODUCT TERMINOLOGY

Use consistent terminology.

Prefer:

CASE

DOSSIER

SOURCE

EVIDENCE

67


===== PAGE 68 =====
CLAIM

STATEMENT

EVENT

TIMELINE

INVESTIGATION

COLLABORATOR

Avoid unnecessarily technical terms in the consumer UI.

Internal technical terms may differ.

126. DO NOT BUILD THE WHOLE SYSTEM IN ONE

GIANT STEP

Build iteratively.

PHASE 1 — FOUNDATION

Repository

Architecture

Database

Authentication

User model

Case model

Basic permissions

Design system

PHASE 2 — CONSOLE

Investigative UI

Media window

Evidence panel

Transcript

Timeline

Source register

Detective panel

PHASE 3 — DOSSIER

Dossier object

Source ingestion

Claims

Events

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

68


===== PAGE 69 =====
People

Evidence

Relationships

PHASE 4 — RESEARCH ENGINE

Provider abstraction

Search

Retrieval

Deduplication

Source processing

PHASE 5 — MEDIA

Video

Audio

Images

Documents

Transcription

Timestamp navigation

PHASE 6 — INTELLIGENCE

Entity extraction

Claim extraction

Timeline

Contradictions

Evidence graph

PHASE 7 — COLLABORATION

Invitations

Roles

Permissions

Comments

Audit

PHASE 8 — SUBSCRIPTIONS

Plans

Entitlements

Usage

Billing

PHASE 9 — BROADCAST

Broadcast mode

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

•

•

•

69


===== PAGE 70 =====
Voice commands

Graphics

Live investigation controls

PHASE 10 — PRODUCTION HARDENING

Security

Performance

Testing

Observability

Backups

Disaster recovery

Abuse prevention

127. CLAUDE CODE WORKFLOW

Before changing code:

Inspect the repository.

Understand existing architecture.

Read CLAUDE.md .

Identify affected modules.

Make a plan.

Implement the smallest coherent change.

Run tests.

Run type checking.

Run linting.

Review security implications.

Review UI behaviour.

Report what changed.

Do not blindly rewrite working code.

128. CLAUDE.md

Create a root-level CLAUDE.md .

It should contain:

Product mission

Architecture rules

Naming conventions

Security rules

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

1.

2.

3.

4.

5.

6.

7.

8.

9.

10.

11.

12.

•

•

•

•

70


===== PAGE 71 =====
Testing rules

Privacy rules

No-hallucination rules

Media rules

Coding standards

Deployment rules

Keep the permanent file concise.

Put detailed workflows into skills.

129. CLAUDE CODE SKILLS

Create reusable skills for:

/research

/build-dossier

/review-evidence

/audit-security

/test-investigation

/review-media

/review-permissions

/build-broadcast

/review-source-provenance

Each skill should have a narrowly defined purpose.

130. SUBAGENTS

Use specialized subagents where appropriate.

Potential agents:

ResearchAgent

EvidenceAgent

SourceVerificationAgent

MediaAgent

TimelineAgent

SecurityAgent

•

•

•

•

•

•

71


===== PAGE 72 =====
TestAgent

UXAgent

Do not create unnecessary agents.

Use isolation when a task involves large research or codebase inspection.

131. RESEARCH AGENT

Responsibilities:

Decompose research questions

Discover sources

Evaluate relevance

Identify source duplication

Return structured source candidates

It should not directly alter the final dossier without passing through the dossier pipeline.

132. EVIDENCE AGENT

Responsibilities:

Identify evidence

Link evidence to sources

Link evidence to claims

Identify potential contradictions

It must preserve provenance.

133. SOURCE VERIFICATION AGENT

Responsibilities:

Check source metadata

Detect duplicate/syndicated sources

Identify primary source where possible

Flag questionable provenance

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

72


===== PAGE 73 =====
134. SECURITY AGENT

Review:

Authentication

Authorization

Row-level security

API endpoints

Private cases

Collaboration

File access

Exports

Secrets

135. TEST AGENT

Verify:

Unit tests

Integration tests

End-to-end tests

Permissions

Critical workflows

136. HOOKS

Use deterministic hooks for development safety.

Examples:

Run formatter

Run lint

Run tests

Prevent accidental destructive operations

Check secrets

Validate migrations

Do not rely solely on prose instructions for security-critical constraints.

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

73


===== PAGE 74 =====
137. MCP

Where external services are required, use appropriate tool integrations rather than hard-coding provider

logic into the core application.

Potential integrations:

DATABASE

SEARCH

WEB RETRIEVAL

MEDIA

STORAGE

TRANSCRIPTION

PAYMENTS

EMAIL

ANALYTICS

Each integration should have an abstraction layer.

138. SECRETS

Never place:

API keys

Provider secrets

Database passwords

Payment secrets

in frontend code.

Use environment variables/secrets management.

139. ENVIRONMENT SEPARATION

Create:

development

staging

production

•

•

•

•

74


===== PAGE 75 =====
Do not allow development configuration to accidentally point to production data.

140. DATABASE MIGRATIONS

All schema changes must be versioned.

Never manually alter production schema without a migration.

141. BACKUPS

The system will eventually contain user investigations.

Backups must be implemented before production launch.

142. DATA RETENTION

Define policies for:

Deleted cases

Deleted accounts

Media cache

Source snapshots

Audit logs

Temporary research data

Do not retain everything forever by default.

143. ACCOUNT DELETION

When a user deletes their account, implement a documented data deletion process.

Clearly distinguish:

User-owned data

Required financial records

Security/audit records

Shared collaborative content

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

75


===== PAGE 76 =====
144. ANALYTICS

Track product usage without unnecessarily invading privacy.

Useful metrics:

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

145. ERROR UX

Never display technical stack traces to users.

Instead:

Something went wrong while processing this source.

Then:

RETRY

and provide diagnostic logging internally.

146. EMPTY STATES

Do not show blank dashboards.

Example:

76


===== PAGE 77 =====
NO CASES YET

Give The Detective a case.

[ BEGIN INVESTIGATION ]

147. LOADING STATES

Use meaningful investigative states.

Instead of:

Loading...

Use:

ANALYSING SOURCE

INDEXING MEDIA

BUILDING TIMELINE

CROSS-REFERENCING EVIDENCE

148. DESIGN SYSTEM

Create a reusable design system.

Tokens:

background

surface

surface-elevated

border

text-primary

text-secondary

accent

warning

77


===== PAGE 78 =====
danger

success

Typography:

Strong hierarchy

Compact metadata

High readability

Broadcast-safe sizes

149. ICONOGRAPHY

Use consistent professional icons.

Avoid emojis in the core interface.

The conversational assistant may use minimal expressive language, but the product UI should remain

serious.

150. MOBILE

Mobile should not attempt to replicate the full desktop console.

Create a simplified mobile investigation experience:

CASE

↓

EVIDENCE

↓

MEDIA

↓

ANALYSIS

Desktop remains the primary investigative environment.

•

•

•

•

78


===== PAGE 79 =====
151. TABLET

Tablet should support:

Media viewing

Evidence inspection

Timeline

Source review

Basic investigation

152. DESKTOP

Desktop is the full experience.

Target:

1440×900

1920×1080

2560×1440

153. BROADCAST DESKTOP

Optimize broadcast mode specifically for:

1920×1080

16:9

154. INITIAL DEMO CASE

Build the prototype using:

CASE 001 — MOGOTSI

Populate with mock data sufficient to demonstrate:

Person

•

•

•

•

•

•

79


===== PAGE 80 =====
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

Clearly mark mock data internally.

Do not represent fictional data as real evidence.

155. DEMO SCENARIO

The completed prototype should allow this flow:

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

80


===== PAGE 81 =====
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

This is the minimum compelling demonstration.

156. SECOND DEMO

Create a fictional international case to demonstrate that the architecture is not South Africa-specific.

Example:

81


===== PAGE 82 =====
CASE 002

INTERNATIONAL HISTORICAL INVESTIGATION

Use mock data.

157. SUCCESS CRITERIA

The first serious prototype is successful if a user can:

Create an account.

Create a private case.

Submit an investigation question.

See dossier assembly.

Open the dossier.

See sources.

See evidence.

See people.

See events.

See timeline.

Open media.

View transcript.

Examine claims.

Compare sources.

See potential contradictions.

Ask The Detective a question.

Navigate to evidence from the answer.

Keep the case private.

Invite a collaborator.

Enforce collaborator permissions.

158. SECONDARY SUCCESS CRITERIA

The system should eventually:

Research automatically

Assemble dossiers

Process media

Build timelines

Detect potential contradictions

Maintain provenance

Support collaboration

1.

2.

3.

4.

5.

6.

7.

8.

9.

10.

11.

12.

13.

14.

15.

16.

17.

18.

19.

20.

•

•

•

•

•

•

•

82


===== PAGE 83 =====
Support subscriptions

Support professional research

Support broadcast mode

Support voice commands

Support global cases

159. MOST IMPORTANT ARCHITECTURAL RULE

Do not build this as:

CHAT UI

+

SEARCH API

+

LLM

Build it as:

INVESTIGATIVE PLATFORM

CASE ENGINE

+

RESEARCH ENGINE

+

SOURCE ENGINE

+

MEDIA ENGINE

+

DOSSIER ENGINE

+

EVIDENCE ENGINE

+

TIMELINE ENGINE

+

AI ANALYSIS ENGINE

+

COLLABORATION ENGINE

+

PRIVACY ENGINE

+

BROADCAST ENGINE

The chat interface is merely one way of controlling the system.

•

•

•

•

•

83


===== PAGE 84 =====
160. THE LONG-TERM PRODUCT

The ultimate vision is:

THE DETECTIVE

A person submits:

"Detective, investigate this."

The system responds:

CASE RECEIVED.

Then:

ASSEMBLING DOSSIER.

The dossier is constructed.

The public record is organised.

Media becomes searchable.

Evidence becomes connected.

The user asks questions.

The Detective shows the evidence.

The user can investigate privately.

They may invite collaborators.

They control their case.

And separately, a television host can operate the same underlying technology in front of an audience.

161. THE TELEVISION FLYWHEEL

The long-term ecosystem is:

84


===== PAGE 85 =====
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

The television show is therefore not merely content.

It is the demonstration environment for the product.

162. THE CORE BUSINESS PRINCIPLE

Do not sell:

"An AI chatbot."

Sell:

"Become the investigator."

The user should feel that they have access to the same investigative machinery demonstrated on television.

163. THE CORE BRAND PROMISE

Potential product language:

85


===== PAGE 86 =====
Give The Detective a case.

Don't just hear the story. Investigate it.

Don't just tell me. Show me.

The public record is waiting.

Build the dossier. Follow the evidence.

Do not overuse slogans.

The product experience should communicate the promise.

164. FINAL IMPLEMENTATION INSTRUCTION

Do not attempt to implement every future feature immediately.

First establish a clean, extensible foundation.

Build in vertical slices.

For every major feature:

DATA MODEL

↓

BACKEND

↓

API

↓

STATE

↓

UI

↓

TEST

Do not create disconnected mock interfaces that cannot later be connected to real data.

Mock data may be used for demonstration, but components must be designed so the mock data can later

be replaced with real services without rebuilding the UI.

86


===== PAGE 87 =====
165. FIRST TASK FOR CLAUDE

Before writing significant code:

Inspect the repository.

Identify the current stack.

Identify existing authentication.

Identify existing database.

Identify existing media functionality.

Identify existing AI integrations.

Identify existing UI components.

Identify what can be retained.

Identify what must be refactored.

Produce an architecture assessment.

Produce a proposed implementation plan.

Do not destroy existing functionality without understanding it.

Then begin with:

PHASE 1 — THE INVESTIGATIVE FOUNDATION

Build:

AUTH

USER

CASE

DOSSIER

SOURCE

EVIDENCE

MEDIA

TIMELINE

CLAIM

PERSON

Then build the Investigative Console on top of those objects.

166. FINAL PRODUCT TEST

When the first major version is complete, I should be able to open THE DETECTIVE and experience this:

THE DETECTIVE

1.

2.

3.

4.

5.

6.

7.

8.

9.

10.

11.

12.

87


===== PAGE 88 =====
YOU ARE NOT SUPPOSED TO BE WATCHING

SYSTEM ONLINE

GIVE THE DETECTIVE A CASE

I enter:

"Investigate this."

The system responds:

CASE RECEIVED

ASSEMBLING DOSSIER...

Sources begin appearing.

The timeline forms.

People appear.

Evidence is indexed.

Potential contradictions are identified.

Then:

DOSSIER READY

LET'S INVESTIGATE.

I click an evidence item.

The media appears.

I press play.

The video opens at the relevant timestamp.

The transcript follows.

I ask:

88


===== PAGE 89 =====
"What changed between this statement and the earlier one?"

The Detective compares the sources.

It presents the evidence.

I can see the source.

I can inspect the timeline.

I can examine the claim.

I can follow the evidence.

I can ask another question.

I can invite another investigator.

And at no point does the product feel like I am browsing Google.

I am inside:

THE DETECTIVE.

That is the product we are building.

Do not reduce this vision to a chatbot.

Do not reduce it to a search engine.

Do not reduce it to a dashboard.

Build the underlying investigative operating system.

89