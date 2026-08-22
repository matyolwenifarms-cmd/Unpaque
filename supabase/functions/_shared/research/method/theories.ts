// §6. The fourteen analytic theories, as a closed enum.
//
// Separate from the paradigm on purpose. A paradigm says what counts as
// knowledge; an analytic theory says what you look for in the data. They are
// routinely conflated in methods chapters — "my theoretical framework is
// interpretivism" — and keeping them apart is what makes the coherence check in
// `coherence.ts` possible at all: it compares the two, and cannot compare one
// field with itself.
//
// Five names appear in both lists (grounded theory, phenomenology, symbolic
// interactionism, social constructionism, and discourse work). That is not a
// duplication to be tidied away: each genuinely operates at both levels, and a
// study can declare grounded theory as its paradigm and something else as its
// analytic approach. `alsoAParadigm` records the overlap so the coherence check
// can treat "both, and they agree" as the ordinary case rather than a warning.

import type { ParadigmId } from "./paradigms.ts";

export const THEORY_IDS = [
  "grounded_theory",
  "phenomenology",
  "symbolic_interactionism",
  "social_constructionism",
  "discourse_theory",
  "critical_discourse_theory",
  "narrative_theory",
  "actor_network_theory",
  "structuration_theory",
  "institutional_theory",
  "diffusion_of_innovations",
  "technology_acceptance",
  "social_learning_theory",
  "theory_of_planned_behaviour",
] as const;

export type TheoryId = (typeof THEORY_IDS)[number];

export interface AnalyticTheory {
  readonly id: TheoryId;
  readonly name: string;
  readonly tradition: string;
  readonly gloss: string;
  /** The unit the theory actually asks you to look at. */
  readonly unitOfAnalysis: string;
  /** Whether it expects measurement or interpretation. Drives the coherence check. */
  readonly stance: "measuring" | "interpreting" | "either";
  /** Set where the same name is also a paradigm. */
  readonly alsoAParadigm?: ParadigmId;
  readonly analyticMoves: readonly string[];
}

export const THEORIES: Record<TheoryId, AnalyticTheory> = {
  grounded_theory: {
    id: "grounded_theory",
    name: "Grounded theory",
    tradition: "Glaser & Strauss (1967); Strauss & Corbin (1990); Charmaz (2006)",
    gloss: "Categories are built up from the data and refined by comparing every new case against them.",
    unitOfAnalysis: "the incident",
    stance: "interpreting",
    alsoAParadigm: "grounded_theory",
    analyticMoves: ["open coding", "axial coding", "selective coding", "theoretical sampling"],
  },
  phenomenology: {
    id: "phenomenology",
    name: "Phenomenology",
    tradition: "Giorgi (2009); Smith, Flowers & Larkin, IPA (2009)",
    gloss: "What was this experience actually like, described before it is explained.",
    unitOfAnalysis: "the lived experience",
    stance: "interpreting",
    alsoAParadigm: "phenomenology",
    analyticMoves: ["bracketing", "meaning units", "essence statement"],
  },
  symbolic_interactionism: {
    id: "symbolic_interactionism",
    name: "Symbolic interactionism",
    tradition: "Blumer (1969); Goffman, The Presentation of Self (1959)",
    gloss: "Meaning is worked out between people as they act, so the interaction is the thing to study.",
    unitOfAnalysis: "the interaction",
    stance: "interpreting",
    alsoAParadigm: "symbolic_interactionism",
    analyticMoves: ["situational analysis", "identity work", "impression management"],
  },
  social_constructionism: {
    id: "social_constructionism",
    name: "Social constructionism",
    tradition: "Berger & Luckmann (1966); Gergen (1985)",
    gloss: "How something came to be treated as an obvious fact, and what maintains that.",
    unitOfAnalysis: "the category",
    stance: "interpreting",
    alsoAParadigm: "social_constructionism",
    analyticMoves: ["category analysis", "tracing institutionalisation", "reification critique"],
  },
  discourse_theory: {
    id: "discourse_theory",
    name: "Discourse theory",
    tradition: "Laclau & Mouffe (1985); Potter & Wetherell (1987)",
    gloss: "Language does not just describe positions, it produces them — so look at what the talk is doing.",
    unitOfAnalysis: "the discursive formation",
    stance: "interpreting",
    analyticMoves: ["interpretative repertoires", "subject positions", "articulation analysis"],
  },
  critical_discourse_theory: {
    id: "critical_discourse_theory",
    name: "Critical discourse theory",
    tradition: "Fairclough, Language and Power (1989); van Dijk (1993); Wodak (2001)",
    gloss: "The same attention to language, with the question of whose interests the text serves kept in view.",
    unitOfAnalysis: "the text in its social practice",
    stance: "interpreting",
    analyticMoves: [
      "three-dimensional analysis: text, discursive practice, social practice",
      "transitivity and nominalisation",
      "intertextual tracing",
    ],
  },
  narrative_theory: {
    id: "narrative_theory",
    name: "Narrative theory",
    tradition: "Labov & Waletzky (1967); Riessman, Narrative Methods (2008)",
    gloss: "People make sense of events by telling them as stories, and the shape of the story is data.",
    unitOfAnalysis: "the story as told",
    stance: "interpreting",
    analyticMoves: ["structural analysis", "plot and turning points", "positioning analysis"],
  },
  actor_network_theory: {
    id: "actor_network_theory",
    name: "Actor-network theory",
    tradition: "Latour, Reassembling the Social (2005); Callon (1986); Law (1992)",
    gloss: "Follow how people, objects and technologies get assembled into an arrangement that holds together.",
    unitOfAnalysis: "the association",
    stance: "interpreting",
    analyticMoves: ["following the actors", "translation", "tracing inscription"],
  },
  structuration_theory: {
    id: "structuration_theory",
    name: "Structuration theory",
    tradition: "Giddens, The Constitution of Society (1984)",
    gloss: "Structure and action make each other: rules shape what people do, and doing it keeps the rules in place.",
    unitOfAnalysis: "the recurrent practice",
    stance: "interpreting",
    analyticMoves: ["duality of structure", "identifying rules and resources", "routinisation analysis"],
  },
  institutional_theory: {
    id: "institutional_theory",
    name: "Institutional theory",
    tradition: "DiMaggio & Powell (1983); Meyer & Rowan (1977); Scott (2001)",
    gloss: "Organisations often adopt a practice because it is expected of them rather than because it works.",
    unitOfAnalysis: "the organisational field",
    stance: "either",
    analyticMoves: ["isomorphism analysis", "legitimacy accounts", "decoupling analysis"],
  },
  diffusion_of_innovations: {
    id: "diffusion_of_innovations",
    name: "Diffusion of innovations",
    tradition: "Rogers, Diffusion of Innovations (1962; 5th edn 2003)",
    gloss: "How something new spreads through a population, and what makes some people take it up before others.",
    unitOfAnalysis: "the adoption decision",
    stance: "either",
    analyticMoves: ["adopter categorisation", "attribute analysis", "adoption curve fitting"],
  },
  technology_acceptance: {
    id: "technology_acceptance",
    name: "Technology acceptance",
    tradition: "Davis, TAM (1989); Venkatesh et al., UTAUT (2003)",
    gloss: "Whether people will use a system, modelled from how useful and how easy they expect it to be.",
    unitOfAnalysis: "the individual's intention to use",
    stance: "measuring",
    analyticMoves: ["path modelling", "construct reliability", "mediation testing"],
  },
  social_learning_theory: {
    id: "social_learning_theory",
    name: "Social learning theory",
    tradition: "Bandura, Social Learning Theory (1977); Social Foundations of Thought and Action (1986)",
    gloss: "People learn by watching others and judging what they themselves are capable of.",
    unitOfAnalysis: "the modelled behaviour",
    stance: "either",
    analyticMoves: ["self-efficacy measurement", "modelling and reinforcement analysis"],
  },
  theory_of_planned_behaviour: {
    id: "theory_of_planned_behaviour",
    name: "Theory of planned behaviour",
    tradition: "Ajzen (1991), after Fishbein & Ajzen, Theory of Reasoned Action (1975)",
    gloss: "Intention predicts behaviour, and intention comes from attitude, social pressure and felt control.",
    unitOfAnalysis: "the behavioural intention",
    stance: "measuring",
    analyticMoves: ["construct measurement", "regression on intention", "control-belief elicitation"],
  },
};
