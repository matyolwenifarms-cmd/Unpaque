// Turning what a researcher pasted into what a bibliographic API can answer.
//
// The feature invites a proposal, an abstract, a paragraph of intent. Both
// providers take a single `search`/`query` string and score it against titles
// and abstracts, and neither is a semantic engine: a 200-word paragraph is
// scored as a bag of words in which "the", "this study", "aims to" and
// "framework" are as present as the two words that actually name the subject.
// The long tail of function words is what drags a media-framing question
// toward whatever else happens to score.
//
// So a long paste is reduced to its content terms before it is sent, and the
// researcher is told what was actually searched for. That last part is not
// decoration: a tool that silently searches for something other than what you
// gave it, and then shows you a thin literature, has told you something false
// about your field.
//
// Rejected: sending the paste verbatim and letting the providers cope, which is
// what produced 2025 irrigation trials for a question about media framing.
// Also rejected: asking a model to extract the terms. It would be better, and
// it would make the free tier of this feature depend on a paid key — and the
// whole point of the literature pipeline is that it costs nothing to run.

/** Below this, a query is a phrase somebody typed; leave it exactly alone. */
export const VERBATIM_LIMIT = 160;

/** Above this many terms the query stops discriminating and starts diluting. */
export const MAX_TERMS = 12;

// Function words, plus the vocabulary of research writing itself. The second
// group matters more than the first: "study", "research", "paper", "analysis"
// and "framework" appear in every proposal ever written and in a very large
// share of titles, so they match everything and therefore select nothing.
const STOPWORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "also", "am", "an",
  "and", "any", "are", "as", "at", "be", "because", "been", "before", "being",
  "below", "between", "both", "but", "by", "can", "cannot", "could", "did", "do",
  "does", "doing", "down", "during", "each", "few", "for", "from", "further",
  "had", "has", "have", "having", "he", "her", "here", "hers", "him", "his",
  "how", "however", "i", "if", "in", "into", "is", "it", "its", "itself", "may",
  "me", "might", "more", "most", "must", "my", "no", "nor", "not", "of", "off",
  "on", "once", "only", "or", "other", "ought", "our", "ours", "out", "over",
  "own", "same", "shall", "she", "should", "so", "some", "such", "than", "that",
  "the", "their", "theirs", "them", "then", "there", "these", "they", "this",
  "those", "through", "to", "too", "under", "until", "up", "very", "was", "we",
  "were", "what", "when", "where", "which", "while", "who", "whom", "why",
  "will", "with", "would", "you", "your", "yours",
  // The register of a proposal.
  "aim", "aims", "analyse", "analyses", "analysis", "analyze", "approach",
  "article", "chapter", "conclusion", "consider", "context", "data",
  "discussion", "dissertation", "examine", "examines", "explore", "explores",
  "field", "findings", "framework", "insight", "insights", "introduction",
  "investigate", "investigates", "issue", "issues", "literature", "method",
  "methodology", "methods", "objective", "objectives", "paper", "participants",
  "proposal", "purpose", "question", "questions", "research", "researcher",
  "result", "results", "review", "seeks", "significance", "studies", "study",
  "thesis", "topic", "understand", "understanding", "work",
]);

export interface QueryTerms {
  /** What to send to the providers. */
  query: string;
  /** True when the paste was reduced rather than sent as given. */
  reduced: boolean;
  /** The terms kept, most significant first. Empty when nothing was reduced. */
  terms: string[];
}

/**
 * Reduce a long paste to the terms worth searching for.
 *
 * Short input is returned untouched. Somebody who typed six words meant those
 * six words, and second-guessing a deliberate query is how a search tool starts
 * feeling broken.
 */
export function queryTermsFrom(text: string): QueryTerms {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= VERBATIM_LIMIT) {
    return { query: trimmed, reduced: false, terms: [] };
  }

  const counts = new Map<string, { word: string; count: number; first: number }>();
  let position = 0;
  // Unicode-aware: a literature is not only in English, and \w would cut
  // "Öffentlichkeit" in half and drop every accented term on the floor.
  for (const raw of trimmed.split(/[^\p{L}\p{N}-]+/u)) {
    const word = raw.replace(/^-+|-+$/g, "");
    position += 1;
    if (word.length < 4) continue;
    const key = word.toLocaleLowerCase();
    if (STOPWORDS.has(key)) continue;
    if (/^\d+$/.test(key)) continue;
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { word, count: 1, first: position });
  }

  const terms = [...counts.values()]
    // Frequency first: in a proposal the subject is the thing said repeatedly.
    // Ties break on first appearance, not alphabetically — the opening sentence
    // of a proposal names the subject, and a stable order also keeps the same
    // paste returning the same search.
    .sort((a, b) => (b.count - a.count) || (a.first - b.first))
    .slice(0, MAX_TERMS)
    .map((entry) => entry.word);

  // Nothing survived — an unusual paste, but a query of "" would return the
  // whole corpus ordered by nothing. The original is the safer answer.
  if (terms.length === 0) return { query: trimmed, reduced: false, terms: [] };

  return { query: terms.join(" "), reduced: true, terms };
}
