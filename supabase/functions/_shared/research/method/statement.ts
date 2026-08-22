// The methodology statement, written from what the researcher declared.
//
// Same move as the APA results section, and for the same reason: this is the
// part of a methodology chapter that is mechanical. A paradigm has a tradition
// with a citation, an ontological and epistemological position, and a set of
// methods it is coherent with. Stating those in prose is transcription, and a
// student doing it by hand gets the citation wrong or omits the position
// entirely — which is the first thing an examiner looks for.
//
// What it will not write: the justification. "Interpretivism was chosen
// because this study is concerned with how participants make sense of..." is
// the researcher's argument about their own study, and no amount of structure
// supplies it. The statement leaves a marked gap where it goes, rather than
// filling it with something plausible — a chapter with a fluent but unearned
// rationale is worse than one with an obvious hole, because the hole gets
// filled and the fluent paragraph gets marked.

import { PARADIGMS, type ParadigmId } from "./paradigms.ts";
import { THEORIES, type TheoryId } from "./theories.ts";
import { checkCoherence, type Design, type Tension } from "./coherence.ts";

export interface MethodDeclaration extends Design {
  /** How data were or will be gathered, in the researcher's words. */
  collection?: string;
  /** Who or what the sample is. */
  participants?: string;
  /**
   * What licenses a causal reading without randomisation.
   *
   * Declared here rather than inherited: `coherence.ts`'s `Design` deliberately
   * does not carry it, because the coherence check asks whether the design
   * hangs together and a defended counterfactual is an argument rather than a
   * property of the design. `causal.ts` has its own field of the same name for
   * its own purpose — they are not the same question and are not shared.
   */
  identificationStrategy?: string;
}

export interface MethodStatement {
  markdown: string;
  tensions: Tension[];
  /** What the researcher still has to write themselves. Never empty. */
  gaps: string[];
}

/**
 * The tradition as a phrase that can sit inside a sentence.
 *
 * `tradition` already carries its years in parentheses, so wrapping the whole
 * string in another pair produced "(Weber, Economy and Society (1922); …)" —
 * parentheses inside parentheses, which reads as a typesetting fault. The
 * sources are separated by "; " in the data, so they are split and rejoined
 * as prose instead.
 */
function cite(tradition: string): string {
  const sources = tradition.split(";").map((source) => source.trim()).filter(Boolean);
  if (sources.length <= 1) return tradition;
  return `${sources.slice(0, -1).join("; ")} and ${sources[sources.length - 1]}`;
}

export function methodStatement(declaration: MethodDeclaration): MethodStatement {
  const paradigm = PARADIGMS[declaration.paradigm];
  const theory = declaration.theory ? THEORIES[declaration.theory] : undefined;
  const parts: string[] = ["## Methodology"];
  const gaps: string[] = [];

  // --- The paradigm --------------------------------------------------------
  parts.push(
    `This study is conducted within ${article(paradigm.adjective)} **${paradigm.adjective}** paradigm, in the tradition of ${cite(paradigm.tradition)}. ${paradigm.gloss} Its ontological position is ${describeOntology(paradigm.ontology)}, and its epistemological position is ${describeEpistemology(paradigm.epistemology)}.`,
  );
  gaps.push(
    `Why ${paradigm.adjective} rather than another paradigm — the argument from your research question to this position. This is the paragraph an examiner reads first and it is yours to write.`,
  );

  // --- The analytic approach ----------------------------------------------
  if (theory) {
    parts.push(
      `Analysis is framed by **${theory.name.toLowerCase()}**, after ${cite(theory.tradition)}. ${theory.gloss} The unit of analysis is ${theory.unitOfAnalysis}. The analytic moves this entails are ${list(theory.analyticMoves)}.`,
    );
    if (theory.alsoAParadigm && theory.alsoAParadigm === declaration.paradigm) {
      // Worth saying: the reader is entitled to wonder whether the same word
      // in both places is a decision or a duplication.
      parts.push(
        `${theory.name} operates here at both levels — as the paradigm framing what counts as knowledge, and as the analytic approach. That is a coherent position rather than a repetition, and is stated so the reader need not infer it.`,
      );
    }
  } else {
    gaps.push(
      "The analytic approach. A paradigm says what counts as knowledge; it does not say what you look for in the data.",
    );
  }

  // --- Design and sampling -------------------------------------------------
  const design: string[] = [];
  design.push(
    `The design is ${paradigm.design === "either" ? "either fixed or emergent, and this study's is stated below" : paradigm.design}.`,
  );
  if (declaration.sampling) {
    design.push(`Sampling is ${declaration.sampling}.`);
  } else {
    gaps.push("The sampling strategy, and why a sample of this kind answers this question.");
  }
  if (declaration.sampleSize !== undefined) {
    design.push(`The sample comprises ${declaration.sampleSize} ${declaration.participants?.trim() || "participants"}.`);
  } else {
    gaps.push("The sample size, and how it was arrived at.");
  }
  if (declaration.collection?.trim()) {
    design.push(`Data are collected through ${declaration.collection.trim()}.`);
  } else {
    design.push(
      `Methods coherent with this paradigm include ${list(paradigm.methods)}; the method used here is to be stated.`,
    );
    gaps.push("How the data were actually collected.");
  }
  parts.push(design.join(" "));

  // --- What the design licenses -------------------------------------------
  if (declaration.questionType === "causal") {
    parts.push(
      declaration.randomised
        ? "Participants were randomly allocated to conditions, which is what licenses the causal reading of the findings."
        : declaration.identificationStrategy?.trim()
          ? `Random allocation was not used. The causal reading rests on the following identification strategy, which the reader should weigh: ${declaration.identificationStrategy.trim()}`
          : "The research question is causal and the design has no random allocation and no stated identification strategy. Findings are therefore reported as association, not as cause.",
    );
  }

  if (declaration.claimsSaturation) {
    parts.push(
      declaration.saturationAccount?.trim()
        ? `Thematic saturation was judged as follows: ${declaration.saturationAccount.trim()}`
        : "Thematic saturation is claimed. How it was judged is to be stated — saturation is a conclusion about a process, and without the process it is an assertion.",
    );
    if (!declaration.saturationAccount?.trim()) {
      gaps.push("How saturation was judged: how many interviews produced no new codes, and against what.");
    }
  }

  // --- Always ---------------------------------------------------------------
  gaps.push(
    "Ethics: approval, consent, and how participants' identities are protected. Nothing here can write that for you.",
  );

  return { markdown: parts.join("\n\n"), tensions: checkCoherence(declaration), gaps };
}

function describeOntology(ontology: string): string {
  switch (ontology) {
    case "realist": return "realist — there is a world independent of what anyone believes about it";
    case "relativist": return "relativist — what counts as real is constituted in the accounts people give";
    case "stratified": return "stratified — real structures exist beneath what can be observed, and generate it";
    default: return "pluralist — what is treated as real depends on what the question requires";
  }
}

function describeEpistemology(epistemology: string): string {
  switch (epistemology) {
    case "objectivist": return "objectivist — the researcher aims to describe without altering what is described";
    case "subjectivist": return "subjectivist — knowledge is made in the meeting between researcher and participant";
    case "transactional": return "transactional — findings are produced in the interaction and the researcher is part of it";
    default: return "pragmatic — the question decides what counts as adequate knowledge";
  }
}

/**
 * A list in prose, separated by semicolons where an item contains a comma.
 *
 * One of the analytic-move lists begins "three-dimensional analysis: text,
 * discursive practice, social practice" — comma-joined with the rest, the
 * reader cannot tell where one move ends and the next begins, and the list
 * silently reads as six items instead of three.
 */
function list(items: readonly string[]): string {
  if (items.length === 0) return "none stated";
  if (items.length === 1) return items[0]!;
  const separator = items.some((item) => item.includes(",")) ? "; " : ", ";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(separator)}${separator.trim()} and ${items[items.length - 1]}`;
}

/** "a" or "an", by the sound the word starts with rather than by its letter. */
function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

/** Every paradigm compatible with a given analytic theory, for the picker. */
export function paradigmsFor(theory: TheoryId): ParadigmId[] {
  const stance = THEORIES[theory].stance;
  return (Object.keys(PARADIGMS) as ParadigmId[]).filter((id) => {
    if (stance === "either") return true;
    const measuring = PARADIGMS[id].epistemology === "objectivist";
    return stance === "measuring" ? measuring || PARADIGMS[id].epistemology === "pragmatic"
      : !measuring || PARADIGMS[id].epistemology === "pragmatic";
  });
}
