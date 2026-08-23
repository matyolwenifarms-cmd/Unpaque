// Reading a proposal's declared design out of its prose, so that §6 coherence
// checking has something to check.
//
// `checkCoherence` is arithmetic over declared fields: a paradigm, a theory, a
// sampling approach, a sample size. It was built for a researcher who has sat
// down and chosen each one in the workspace. A student who uploads a proposal
// has chosen all of them — in a methodology chapter, in prose — and
// declared none of them anywhere the check can see.
//
// So this file reads them back out. Every rule below is a phrase table and a
// position comparison; nothing here judges anything, and no model is involved.
//
// **Two things it deliberately refuses to do.**
//
// It will not hand `checkCoherence` a field it only saw in somebody else's
// sentence. A literature review that says "positivism dominated early media
// research" has not declared a paradigm, and a coherence tension computed from
// that sentence is a supervisor telling a student off for a choice they never
// made. So each reading carries `how`, and `designFrom` passes on only the
// declared ones. The state where a tension is raised against a mentioned
// paradigm is not reachable.
//
// **The passive voice.** A methodology chapter is written almost entirely in
// it — "data will be analysed using critical discourse analysis",
// "participants were recruited through purposive sampling" — and none of
// those sentences say whose study they belong to. A rule that required a
// first-person or "this study" marker therefore read a real methodology
// chapter as a series of remarks about other people's work, and declared
// nothing. So a sentence also counts as declared when it sits inside the
// methodology chapter, which is what the section headings are read for.
// Rejected: treating the passive voice itself as a declaration, which would
// have taken "interviews were conducted by Smith (2010)" in a literature
// review as this study's method.
//
// And it will not read a question type out of ordinary prose. Nearly every
// proposal written contains the words "explore" and "describe" in its
// introduction; matching them would classify almost every study as exploratory
// and then raise tensions against that. A question type is read only from a
// sentence that is actually a question, or one that says so. Where the
// proposal never writes its question out, that is reported as a gap, which is
// itself the more useful finding.

import type { Design } from "../method/coherence.ts";
import { PARADIGMS, type ParadigmId } from "../method/paradigms.ts";
import type { TheoryId } from "../method/theories.ts";

/** One thing read out of the prose, with the words it was read from. */
export interface Read<T> {
  readonly value: T;
  /** The words that were matched, verbatim. */
  readonly phrase: string;
  /**
   * Enough of the sentence around them to judge the reading, and always
   * containing `phrase`. Evidence that does not show the thing it is evidence
   * for is worse than none: the student cannot check it and learns to nod.
   */
  readonly evidence: string;
  /**
   * `declared` where the sentence claims it for this study; `mentioned` where
   * the words appear but the sentence is about somebody else's work.
   */
  readonly how: "declared" | "mentioned";
}

export type Sampling = "statistical" | "purposive";
export type QuestionType = "causal" | "associational" | "descriptive" | "exploratory";

export interface DesignReading {
  readonly paradigm: Read<ParadigmId> | null;
  readonly theory: Read<TheoryId> | null;
  readonly sampling: Read<Sampling> | null;
  readonly sampleSize: Read<number> | null;
  readonly questionType: Read<QuestionType> | null;
  readonly randomised: Read<boolean> | null;
  readonly claimsSaturation: Read<boolean> | null;
  /**
   * The things a proposal ought to state and this one does not.
   *
   * Only four, and deliberately not all seven. Random allocation and a
   * saturation claim are absent from most perfectly good designs — an
   * interpretive study has neither — and listing them as gaps would put
   * two lines of noise in every report. A report a student learns to skim has
   * stopped working.
   */
  readonly notStated: readonly string[];
}

/**
 * Phrases that name a paradigm.
 *
 * Keyed by `ParadigmId`, so the compiler refuses a table that has forgotten
 * one. Written out rather than derived from each paradigm's `name`, because
 * the noun is the form that almost never appears: a methodology chapter says
 * "an interpretivist paradigm", not "Interpretivism".
 */
export const PARADIGM_WORDS: Record<ParadigmId, readonly string[]> = {
  positivism: ["positivism", "positivist"],
  post_positivism: [
    "post-positivism", "post positivism", "postpositivism",
    "post-positivist", "post positivist", "postpositivist",
  ],
  interpretivism: [
    "interpretivism", "interpretivist", "interpretative paradigm",
    "interpretive paradigm", "interpretativism", "interpretativist",
  ],
  constructivism: ["constructivism", "constructivist"],
  pragmatism: ["pragmatism", "pragmatist", "pragmatic paradigm"],
  critical_theory: ["critical theory", "critical paradigm", "critical-theoretical"],
  feminist_theory: ["feminist theory", "feminist paradigm", "feminist epistemology"],
  symbolic_interactionism: ["symbolic interactionism", "symbolic interactionist"],
  phenomenology: ["phenomenology", "phenomenological"],
  grounded_theory: ["grounded theory", "grounded-theory"],
  hermeneutics: ["hermeneutics", "hermeneutic"],
  critical_realism: ["critical realism", "critical realist"],
  postmodernism: ["postmodernism", "postmodernist", "post-modernism", "post-modern"],
  social_constructionism: ["social constructionism", "social constructionist"],
  realism: ["realism", "realist"],
};

/**
 * Phrases that name an analytic theory.
 *
 * No acronyms. `IPA`, `CDA`, `TAM` and `ANT` each name a theory here and each
 * names several other things, and a proposal about ants would otherwise arrive
 * declaring actor-network theory.
 */
export const THEORY_WORDS: Record<TheoryId, readonly string[]> = {
  grounded_theory: ["grounded theory", "constant comparative method"],
  phenomenology: [
    "interpretative phenomenological analysis", "phenomenology", "phenomenological",
  ],
  symbolic_interactionism: ["symbolic interactionism", "symbolic interactionist"],
  social_constructionism: ["social constructionism", "social constructionist"],
  discourse_theory: ["discourse theory", "discourse analysis"],
  critical_discourse_theory: ["critical discourse theory", "critical discourse analysis"],
  narrative_theory: ["narrative theory", "narrative analysis", "narrative inquiry"],
  actor_network_theory: ["actor-network theory", "actor network theory"],
  structuration_theory: ["structuration theory", "structuration"],
  institutional_theory: ["institutional theory", "neo-institutional theory", "institutional logics"],
  diffusion_of_innovations: [
    "diffusion of innovations", "diffusion of innovation", "diffusion theory",
  ],
  technology_acceptance: ["technology acceptance model", "technology acceptance"],
  social_learning_theory: ["social learning theory", "social cognitive theory"],
  theory_of_planned_behaviour: [
    "theory of planned behaviour", "theory of planned behavior", "planned behaviour",
  ],
};

/**
 * Sampling, which is how the cases were chosen.
 *
 * `randomly assigned` is not in here, and that is the point. Random *sampling*
 * chooses who is in the study; random *allocation* chooses which arm they go
 * into, and only the second licenses a causal claim. They are one word apart
 * in English and a whole design apart in method, and running them together is
 * the error this separation exists to make visible.
 */
export const SAMPLING_WORDS: Record<Sampling, readonly string[]> = {
  purposive: [
    "purposive sampling", "purposeful sampling", "snowball sampling",
    "convenience sampling", "theoretical sampling", "maximum variation sampling",
    "purposively selected", "purposively sampled",
  ],
  statistical: [
    "simple random sample", "stratified random sample", "stratified random sampling",
    "probability sampling", "systematic sampling", "cluster sampling",
    "random sampling", "randomly selected", "random sample",
  ],
};

/** Random allocation, which is the thing that licenses a causal claim. */
export const ALLOCATION_WORDS: Record<"yes" | "no", readonly string[]> = {
  yes: [
    "randomly assigned", "random assignment", "random allocation",
    "randomly allocated", "randomised controlled", "randomized controlled",
  ],
  no: [
    "quasi-experimental", "non-randomised", "non-randomized",
    "without random assignment", "no random assignment",
  ],
};

export const QUESTION_WORDS: Record<QuestionType, readonly string[]> = {
  causal: [
    "the effect of", "effects of", "the impact of", "impact of",
    "causal effect", "causes of", "leads to", "bring about",
  ],
  associational: [
    "relationship between", "association between", "correlation between",
    "correlated with", "associated with", "to what extent", "predictors of",
    "predict", "predicts",
  ],
  descriptive: [
    "prevalence of", "what proportion", "how many", "describe the",
    "description of", "characterise", "characterize", "profile of",
  ],
  exploratory: [
    "lived experience", "what are the experiences", "in what ways",
    "how do", "how does", "explore", "exploratory", "understand how",
  ],
};

export const SATURATION_WORDS: readonly string[] = [
  "data saturation", "thematic saturation", "saturation was reached",
  "saturation had been reached", "until saturation", "saturation point",
  "no new themes",
];

/**
 * A sentence that claims something for this study rather than reporting it.
 *
 * A citation in the sentence is deliberately not a demotion. "This study
 * adopts an interpretivist paradigm (Creswell, 2014)" is the single most
 * common way a methodology chapter declares itself, and a rule that read a
 * bracketed reference as somebody else's work would reject nearly all of them.
 */
const CLAIMS =
  /\b(?:this|the present|the proposed|the current|my|our)\s+(?:study|research|proposal|dissertation|thesis|project|inquiry|enquiry|investigation)\b|\b(?:I|we)\s+(?:adopt|adopted|will|shall|take|took|draw|drew|locate|located|position|positioned|employ|employed|use|used)\b|\bthe\s+(?:methodology|approach|design|framework|paradigm|study|research)\s+(?:is|was|will be|adopts|adopted|takes|took|draws|drew|employs|employed|follows|followed)\b|\b(?:underpins|underpin|underpinned by|informed by|guided by|is adopted|will be adopted|is employed|will be employed)\b/i;

/** Ends a piece that is not the end of a sentence. */
const NOT_A_STOP = /(?:\b(?:e\.g|i\.e|cf|viz|vs|etc|al|Dr|Prof|Mr|Mrs|Ms|St|No|Fig|Eq|Vol|pp|ed|eds)\.|\b\p{Lu}\.)$/u;

/** How much of the sentence to keep on either side of a match. */
const EVIDENCE_WINDOW = 140;

/**
 * The sentences of a document, near enough.
 *
 * Near enough is the standard because a mis-split costs a slightly ragged
 * quotation, not a wrong reading: the phrase tables match inside a sentence,
 * and a sentence cut short still contains the words that matched it. What a
 * mis-split must not do is split an initial or an abbreviation away from its
 * sentence and leave `A.` standing as evidence, which is what NOT_A_STOP is
 * for.
 */
export function sentencesIn(text: string): string[] {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat === "") return [];

  const pieces = flat.split(/(?<=[.!?])\s+/);
  const sentences: string[] = [];
  for (const piece of pieces) {
    const previous = sentences[sentences.length - 1];
    const runsOn = previous !== undefined &&
      (NOT_A_STOP.test(previous) || /^[\p{Ll}\d]/u.test(piece));
    if (runsOn) sentences[sentences.length - 1] = `${previous} ${piece}`;
    else sentences.push(piece);
  }
  return sentences;
}

/**
 * A heading that opens the part of a proposal about its own study.
 *
 * Sub-headings inside it — `3.2 Sampling`, `Ethical considerations` —
 * match neither this nor ELSEWHERE, which is the point: the section runs on
 * until something names a different part of the document, rather than ending
 * at the first sub-heading.
 */
const METHOD_HEADING =
  /^\s*(?:chapter\s+[\w-]+\s*[.:]?\s*)?(?:\d+(?:\.\d+)*\.?\s*)?(?:the\s+)?(?:research\s+)?(?:methodolog(?:y|ies)|methods?|research design|design and methods?|materials and methods)\s*:?\s*$/i;

/** A heading that closes it, by naming a part of the document that is not it. */
const ELSEWHERE_HEADING =
  /^\s*(?:chapter\s+[\w-]+\s*[.:]?\s*)?(?:\d+(?:\.\d+)*\.?\s*)?(?:results?|findings?|discussion|conclusions?|recommendations?|references?|bibliography|introduction|background|literature review|theoretical framework|budget|timeline|work plan|appendix|appendices)\s*:?\s*$/i;

interface Passage {
  readonly sentence: string;
  /** True where the sentence sits in the part of the proposal about itself. */
  readonly ownWork: boolean;
}

/** Every sentence, and whether the proposal was talking about itself. */
function passagesOf(text: string): Passage[] {
  const passages: Passage[] = [];
  let ownWork = false;
  let block: string[] = [];

  const flush = () => {
    if (block.length > 0) {
      for (const sentence of sentencesIn(block.join("\n"))) passages.push({ sentence, ownWork });
    }
    block = [];
  };

  for (const line of text.split("\n")) {
    if (METHOD_HEADING.test(line)) {
      flush();
      ownWork = true;
      continue;
    }
    if (ELSEWHERE_HEADING.test(line)) {
      flush();
      ownWork = false;
      continue;
    }
    block.push(line);
  }
  flush();

  return passages;
}

interface Hit<T> {
  value: T;
  phrase: string;
  index: number;
}

/**
 * The best match for one sentence, or nothing.
 *
 * Earliest position wins, and nothing else does. That single rule is what
 * keeps `critical realism` from being read as `realism` and `post-positivist`
 * from being read as `positivist`: in both pairs the longer phrase starts
 * first, so the shorter one never gets to compete.
 *
 * It is sufficient only while no phrase in a table is a prefix of a phrase
 * listed under a different value — two such phrases start at the same
 * index and the winner would be whichever the table happened to list first.
 * Rejected: quietly preferring the longer of the two, which resolves the
 * ambiguity by guessing and leaves nothing to notice. `design.test.ts`
 * asserts no such pair exists instead, so adding one turns a test red rather
 * than changing a reading nobody asked to change.
 */
function bestIn<T extends string | number | boolean>(
  sentence: string,
  table: readonly (readonly [T, readonly string[]])[],
): Hit<T> | null {
  const lower = sentence.toLowerCase();
  let best: Hit<T> | null = null;
  for (const [value, phrases] of table) {
    for (const phrase of phrases) {
      const index = lower.indexOf(phrase);
      if (index === -1) continue;
      if (best !== null && index >= best.index) continue;
      best = { value, phrase: sentence.slice(index, index + phrase.length), index };
    }
  }
  return best;
}

/**
 * The words around a match, widened to whole words.
 *
 * Windowed rather than truncated from the start, because a proposal extracted
 * from a PDF sometimes arrives with a 900-character run and no full stop in
 * it. Truncating that at a fixed length shows the student a quotation that
 * does not contain the phrase it is supposed to evidence.
 */
function evidenceFor(sentence: string, index: number, length: number): string {
  if (sentence.length <= EVIDENCE_WINDOW * 2) return sentence;

  let start = Math.max(0, index - EVIDENCE_WINDOW);
  let end = Math.min(sentence.length, index + length + EVIDENCE_WINDOW);
  while (start > 0 && !/\s/.test(sentence[start - 1]!)) start -= 1;
  while (end < sentence.length && !/\s/.test(sentence[end]!)) end += 1;

  const opening = start > 0 ? "… " : "";
  const closing = end < sentence.length ? " …" : "";
  return `${opening}${sentence.slice(start, end).trim()}${closing}`;
}

/** Scan every sentence, preferring one that claims the thing for this study. */
function readField<T extends string | number | boolean>(
  passages: readonly Passage[],
  table: readonly (readonly [T, readonly string[]])[],
  only?: (sentence: string) => boolean,
): Read<T> | null {
  let mentioned: Read<T> | null = null;

  for (const { sentence, ownWork } of passages) {
    if (only && !only(sentence)) continue;
    const hit = bestIn(sentence, table);
    if (hit === null) continue;

    const read: Read<T> = {
      value: hit.value,
      phrase: hit.phrase,
      evidence: evidenceFor(sentence, hit.index, hit.phrase.length),
      how: ownWork || CLAIMS.test(sentence) ? "declared" : "mentioned",
    };
    // A declared reading ends the search. A mentioned one is held in case
    // nothing better turns up, which is why the literature review at the front
    // of a proposal does not decide its paradigm.
    if (read.how === "declared") return read;
    if (mentioned === null) mentioned = read;
  }

  return mentioned;
}

const entries = <T extends string>(table: Record<T, readonly string[]>) =>
  Object.entries(table).map(([key, phrases]) => [key as T, phrases as readonly string[]] as const);

/** `n = 200`, and the counted nouns a proposal states a sample in. */
const SAMPLE_SIZE = /\bn\s*=\s*(\d{1,6})\b/i;
const COUNTED =
  /\b(\d{1,5}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\s+(?:[a-z-]+\s+){0,2}(participants?|respondents?|interviewees?|informants?|learners?|students?|teachers?|patients?|households?|firms?|organisations?|organizations?|schools?|clinics?|cases?|documents?|transcripts?|articles?)\b/i;

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90, hundred: 100,
};

function readSampleSize(passages: readonly Passage[]): Read<number> | null {
  let mentioned: Read<number> | null = null;

  for (const { sentence, ownWork } of passages) {
    // `n = 200` first: it is unambiguous, and it is what a quantitative
    // proposal writes. The counted-noun form is the fallback because it can
    // catch a number that belongs to something else in the same sentence.
    const explicit = SAMPLE_SIZE.exec(sentence);
    const counted = explicit ? null : COUNTED.exec(sentence);
    const match = explicit ?? counted;
    if (!match) continue;

    const written = match[1]!.toLowerCase();
    const value = /^\d+$/.test(written) ? Number.parseInt(written, 10) : NUMBER_WORDS[written];
    if (value === undefined || value <= 0) continue;

    const read: Read<number> = {
      value,
      phrase: match[0],
      evidence: evidenceFor(sentence, match.index, match[0].length),
      how: ownWork || CLAIMS.test(sentence) ? "declared" : "mentioned",
    };
    if (read.how === "declared") return read;
    if (mentioned === null) mentioned = read;
  }

  return mentioned;
}

/** A sentence that is a research question, or says it is about to give one. */
function isAQuestion(sentence: string): boolean {
  return sentence.trimEnd().endsWith("?") || /\bresearch question/i.test(sentence);
}

/** What the proposal says its design is. */
export function readDesign(text: string): DesignReading {
  const passages = passagesOf(text);

  const paradigm = readField(passages, entries(PARADIGM_WORDS));
  const theory = readField(passages, entries(THEORY_WORDS));
  const sampling = readField(passages, entries(SAMPLING_WORDS));
  const sampleSize = readSampleSize(passages);
  const questionType = readField(passages, entries(QUESTION_WORDS), isAQuestion);

  const allocation = readField(
    passages,
    entries(ALLOCATION_WORDS).map(([key, phrases]) => [key === "yes", phrases] as const),
  );
  const saturation = readField(passages, [[true, SATURATION_WORDS] as const]);

  const notStated: string[] = [];
  if (paradigm === null) notStated.push("the paradigm the study works in");
  if (sampling === null) notStated.push("how the sample was chosen");
  if (sampleSize === null) notStated.push("how large the sample is");
  if (questionType === null) notStated.push("the research question, written as a question");

  return {
    paradigm,
    theory,
    sampling,
    sampleSize,
    questionType,
    randomised: allocation,
    claimsSaturation: saturation,
    notStated,
  };
}

/**
 * The design as `checkCoherence` needs it, or nothing.
 *
 * Nothing when the paradigm was never declared for this study, because the
 * coherence check is a comparison *against* the paradigm and there is no
 * honest default to supply. A proposal that has not said what it is cannot be
 * told that what it is does not fit.
 */
export function designFrom(reading: DesignReading): Design | null {
  const declared = <T>(read: Read<T> | null): T | undefined =>
    read !== null && read.how === "declared" ? read.value : undefined;

  const paradigm = declared(reading.paradigm);
  if (paradigm === undefined) return null;

  return {
    paradigm,
    theory: declared(reading.theory),
    sampling: declared(reading.sampling),
    sampleSize: declared(reading.sampleSize),
    questionType: declared(reading.questionType),
    randomised: declared(reading.randomised),
    claimsSaturation: declared(reading.claimsSaturation),
  };
}

/** What was read, and what was not, in sentences a student can act on. */
export function designNotes(reading: DesignReading): string[] {
  const notes: string[] = [];

  // What was read is not reported here. `DesignReading` carries every reading
  // with the sentence it came from, and any surface worth showing this on
  // shows those next to each other; repeating them as prose puts the same
  // words on one screen twice, which is how a reader learns that half of a
  // report is padding. These notes are the findings only.
  if (reading.paradigm !== null && reading.paradigm.how === "mentioned") {
    notes.push(
      `${PARADIGMS[reading.paradigm.value].name} appears in the proposal, but not in a sentence about this study: "${reading.paradigm.evidence}" — so the coherence check was not run. Saying which paradigm the study works in, in one sentence, is what turns that on.`,
    );
  }

  if (reading.sampling !== null && reading.randomised !== null && reading.randomised.value) {
    notes.push(
      `The proposal mentions both ${reading.sampling.value === "statistical" ? "random sampling" : "purposive sampling"} and random allocation. They are different things: sampling decides who is in the study, allocation decides which arm they go into, and only allocation supports a causal claim. Worth checking that the proposal means both.`,
    );
  }

  if (reading.notStated.length > 0) {
    const list = reading.notStated.join("; ");
    notes.push(
      `Nothing in the proposal states ${list}. That may be because it is stated in words this does not recognise — it reads phrases, not meaning — but each of them is something an examiner will look for by name.`,
    );
  }

  return notes;
}
