import type { DiagnosticReport } from "./report.ts";

// Unpaque's product claim is a boundary: it describes structure, and it does
// not tell you what anyone thinks or feels or intends. A boundary that lives
// only in a system prompt is a boundary the model crosses the first time
// somebody pastes a resignation letter about a bereavement.
//
// So the prompt asks, and this refuses. Every string Unpaque writes itself is
// scanned before it can reach a screen; a hit fails the report rather than
// editing it, because a finding with the mind-reading filed off is a finding
// whose reasoning we can no longer see.
//
// What is deliberately NOT banned is the vocabulary of the frameworks
// themselves. "Evasion of responsibility", "denial", "minimisation" and
// "shifting the blame" are the named strategies of Image Repair Theory;
// "face-threatening", "hedging" and "positive face" are Face Theory;
// "passive agency" and "nominalisation" are Critical Discourse Analysis. A
// guard that swallowed those would leave Unpaque unable to say anything, which
// is a different failure but still a failure.

export type ViolationKind = "reader_state" | "verdict" | "intent";

export interface GuardRule {
  id: string;
  kind: ViolationKind;
  /**
   * Non-global on purpose. A /g/ regex carries `lastIndex` between calls, so
   * the same rule reused across several fields starts matching from wherever
   * it stopped and silently misses hits. One match per rule per field is all
   * the guard needs to fail a report.
   */
  pattern: RegExp;
  why: string;
}

export const GUARD_RULES: readonly GuardRule[] = [
  // ---- Predicting a mind -------------------------------------------------
  {
    id: "modal-internal-state",
    kind: "reader_state",
    pattern: /\b(will|would|may|might|could|is going to|are going to)\s+(feel|think|believe|assume|conclude|perceive|interpret|react|respond)\b/i,
    why: "predicts what someone will feel, think or conclude",
  },
  {
    id: "makes-feel",
    kind: "reader_state",
    pattern: /\bmakes?\s+(the\s+)?\w+\s+feel\b/i,
    why: "asserts an effect on a reader's feelings",
  },
  {
    id: "comes-across",
    kind: "reader_state",
    pattern: /\bcomes?\s+across\s+as\b/i,
    why: "describes reception rather than structure",
  },
  {
    id: "reader-reaction-noun",
    kind: "reader_state",
    pattern: /\bthe\s+(reader|recipient|audience)'?s?\s+(reaction|response|feelings?|impression|state\s+of\s+mind)\b/i,
    why: "names a reader's inner state as the subject of the finding",
  },
  {
    id: "leaves-the-reader",
    kind: "reader_state",
    pattern: /\bleaves?\s+the\s+(reader|recipient|audience)\b/i,
    why: "asserts an effect on a reader",
  },

  // ---- Ruling on honesty or character ------------------------------------
  {
    id: "honesty-verdict",
    kind: "verdict",
    pattern: /\b(dishonest|dishonesty|deceptive|deceit|deceitful|untruthful|insincere|disingenuous|duplicitous|misleading)\b/i,
    why: "issues a verdict on honesty",
  },
  {
    id: "lying",
    // "lies" is excluded: "responsibility lies with the department" is ordinary
    // structural prose and banning it would cost more than it saves.
    kind: "verdict",
    pattern: /\b(lying|liar|a\s+lie|falsehood)\b/i,
    why: "asserts that the writer is lying",
  },
  {
    id: "manipulation",
    kind: "verdict",
    pattern: /\bmanipulat(e|es|ed|ing|ive|ion)\b/i,
    why: "characterises the text as manipulation",
  },
  {
    id: "gaslighting",
    kind: "verdict",
    pattern: /\bgaslight(ing|ed|s)?\b/i,
    why: "applies a clinical-sounding accusation",
  },
  {
    id: "bad-faith",
    kind: "verdict",
    pattern: /\b(bad\s+faith|acting\s+in\s+bad\s+faith)\b/i,
    why: "attributes bad faith",
  },
  {
    id: "moral-verdict",
    kind: "verdict",
    pattern: /\b(unethical|immoral|shameful|cynical|callous)\b/i,
    why: "issues a moral judgement",
  },
  {
    id: "sincerity-verdict",
    kind: "verdict",
    // Mortification — Benoit's term for accepting responsibility — stays
    // available; what is refused is grading how heartfelt it was.
    pattern: /\b(genuine|sincere|heartfelt|hollow|empty)\s+(apology|apologies|remorse|regret|contrition)\b/i,
    why: "grades the sincerity of an apology",
  },

  // ---- Attributing intent ------------------------------------------------
  {
    id: "author-intent",
    kind: "intent",
    pattern: /\b(the\s+)?(author|writer|sender|speaker)\s+(intends?|intended|wants?|wanted|is\s+trying|means?\s+to|hopes?)\b/i,
    why: "attributes an intention to the writer",
  },
  {
    id: "intent-adverb",
    kind: "intent",
    // The spec's own summary of Strategic Ambiguity calls it "deliberate
    // vagueness", and that phrasing is fine in a description of the framework.
    // In a finding it is a claim about a mind: Unpaque can say a commitment is
    // left unquantified, but not that someone chose to leave it so.
    pattern: /\b(deliberately|intentionally|knowingly|purposely|calculated\s+to)\b/i,
    why: "asserts the choice was deliberate, which is a claim about intent",
  },
];

export interface Violation {
  ruleId: string;
  kind: ViolationKind;
  /** Where in the report it was found, for the log and the retry. */
  field: string;
  matched: string;
  why: string;
}

export function inspect(text: string, field: string): Violation[] {
  const violations: Violation[] = [];
  for (const rule of GUARD_RULES) {
    const hit = rule.pattern.exec(text);
    if (hit) {
      violations.push({
        ruleId: rule.id,
        kind: rule.kind,
        field,
        matched: hit[0],
        why: rule.why,
      });
    }
  }
  return violations;
}

/**
 * Every string in the report that Unpaque wrote itself.
 *
 * `quotes` and `rewrite.text` are absent by design. Quotes are the analysed
 * text, and a report that cannot quote a source containing the word
 * "dishonest" cannot do its job. `rewrite.text` is a draft of the user's own
 * message rather than a claim about anybody, and censoring it would mean a
 * user who wants to say something blunt gets a rewrite that will not say it.
 */
export function guardedFields(report: DiagnosticReport): Array<[string, string]> {
  const fields: Array<[string, string]> = [];
  for (const section of report.sections) {
    fields.push([`sections.${section.id}.summary`, section.summary]);
    for (const [index, finding] of section.findings.entries()) {
      fields.push([`sections.${section.id}.findings[${index}].claim`, finding.claim]);
    }
  }
  if (report.rewrite) fields.push(["rewrite.note", report.rewrite.note]);
  return fields;
}

export function guardReport(report: DiagnosticReport): Violation[] {
  return guardedFields(report).flatMap(([field, text]) => inspect(text, field));
}

/**
 * The correction handed back to the model on the one retry it gets.
 *
 * Quoting the offending span matters: told only "avoid mind-reading" a model
 * tends to rewrite everything and lose the finding, where told which four
 * words broke the rule it repairs the sentence and keeps the analysis.
 */
export function retryInstruction(violations: Violation[]): string {
  const lines = violations.map((v) => `- ${v.field}: "${v.matched}" — ${v.why}`);
  return [
    "The previous response broke Unpaque's hard boundary in these places:",
    ...lines,
    "",
    "Rewrite only those fields. Describe what the text does structurally.",
    "Do not state what any person feels, thinks, concludes or intended.",
    "Do not judge honesty, sincerity or character. Keep every other field and",
    "every framework attribution exactly as it was.",
  ].join("\n");
}
