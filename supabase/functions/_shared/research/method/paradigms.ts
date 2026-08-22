// §6. The fifteen paradigms, as a closed enum.
//
// Closed for the same reason Unpack's eight frameworks are: an analytic claim
// that cannot name its paradigm does not render. A paradigm is not decoration
// on a methods chapter — it decides what counts as evidence, what a sample is
// for, and whether "generalisable" is a virtue or a category error. A tool that
// let somebody analyse data without declaring one would be helping them write a
// methodology chapter that cannot be defended.
//
// Each entry carries what a supervisor checks and what a first-year student
// reads, which are not the same text. `tradition` names real scholarship; the
// citations are load-bearing and none of them is generated — this module is in
// the same repository as a feature built specifically because language models
// invent references, and inventing one here would be indefensible.

export const PARADIGM_IDS = [
  "positivism",
  "post_positivism",
  "interpretivism",
  "constructivism",
  "pragmatism",
  "critical_theory",
  "feminist_theory",
  "symbolic_interactionism",
  "phenomenology",
  "grounded_theory",
  "hermeneutics",
  "critical_realism",
  "postmodernism",
  "social_constructionism",
  "realism",
] as const;

export type ParadigmId = (typeof PARADIGM_IDS)[number];

/** What the paradigm takes reality to be, in one word, for coherence checking. */
export const ONTOLOGIES = ["realist", "relativist", "stratified", "pluralist"] as const;
export type Ontology = (typeof ONTOLOGIES)[number];

/** What it takes knowledge of that reality to be. */
export const EPISTEMOLOGIES = ["objectivist", "subjectivist", "transactional", "pragmatic"] as const;
export type Epistemology = (typeof EPISTEMOLOGIES)[number];

export interface Paradigm {
  readonly id: ParadigmId;
  readonly name: string;
  /**
   * The adjectival form, for "within a ___ paradigm".
   *
   * Stored rather than derived. The endings do not follow a rule —
   * interpretivism/interpretivist, pragmatism/pragmatic,
   * phenomenology/phenomenological, hermeneutics/hermeneutic — and a statement
   * that says "a interpretivism paradigm" has undermined itself in its first
   * six words.
   */
  readonly adjective: string;
  /** Where it comes from, with a real source a supervisor can look up. */
  readonly tradition: string;
  /** What a first-year student reads. One sentence, no jargon it does not define. */
  readonly gloss: string;
  readonly ontology: Ontology;
  readonly epistemology: Epistemology;
  /** Whether the design is normally fixed in advance or emergent. */
  readonly design: "fixed" | "emergent" | "either";
  /** What a sample is for. This is where most incoherent designs show up. */
  readonly sampling: "statistical" | "purposive" | "either";
  readonly methods: readonly string[];
  readonly dataTypes: readonly string[];
  readonly analyticMoves: readonly string[];
}

export const PARADIGMS: Record<ParadigmId, Paradigm> = {
  positivism: {
    id: "positivism",
    adjective: "positivist",
    name: "Positivism",
    tradition: "Comte, Cours de philosophie positive (1830–42); Durkheim, The Rules of Sociological Method (1895)",
    gloss:
      "There is one reality, it obeys regularities, and a careful observer can measure it without changing it.",
    ontology: "realist",
    epistemology: "objectivist",
    design: "fixed",
    sampling: "statistical",
    methods: ["experiment", "survey", "structured observation", "secondary statistics"],
    dataTypes: ["numeric measures", "closed-response instruments", "official statistics"],
    analyticMoves: ["hypothesis testing", "estimation with confidence intervals", "modelling"],
  },
  post_positivism: {
    id: "post_positivism",
    adjective: "post-positivist",
    name: "Post-positivism",
    tradition: "Popper, The Logic of Scientific Discovery (1959); Campbell & Stanley (1963)",
    gloss:
      "There is one reality but we only ever know it imperfectly, so claims are held provisionally and tested against evidence that could refute them.",
    ontology: "realist",
    epistemology: "objectivist",
    design: "fixed",
    sampling: "statistical",
    methods: ["quasi-experiment", "survey", "content analysis", "mixed methods"],
    dataTypes: ["numeric measures", "coded categorical data"],
    analyticMoves: ["falsification", "triangulation", "estimation with error bounds"],
  },
  interpretivism: {
    id: "interpretivism",
    adjective: "interpretivist",
    name: "Interpretivism",
    tradition: "Weber, Economy and Society (1922); Schütz, The Phenomenology of the Social World (1932)",
    gloss:
      "Social life is made of the meanings people give it, so the job is to understand those meanings rather than to measure behaviour from outside.",
    ontology: "relativist",
    epistemology: "subjectivist",
    design: "emergent",
    sampling: "purposive",
    methods: ["in-depth interview", "ethnography", "participant observation", "document analysis"],
    dataTypes: ["transcripts", "field notes", "documents"],
    analyticMoves: ["thematic analysis", "typology building", "thick description"],
  },
  constructivism: {
    id: "constructivism",
    adjective: "constructivist",
    name: "Constructivism",
    tradition: "Guba & Lincoln, Fourth Generation Evaluation (1989); von Glasersfeld (1995)",
    gloss:
      "Knowledge is built by people rather than found, so an account is judged by how well it is grounded and how honestly it was arrived at.",
    ontology: "relativist",
    epistemology: "transactional",
    design: "emergent",
    sampling: "purposive",
    methods: ["in-depth interview", "focus group", "case study", "participatory design"],
    dataTypes: ["transcripts", "reflexive journals", "artefacts"],
    analyticMoves: ["constant comparison", "member checking", "reflexive memoing"],
  },
  pragmatism: {
    id: "pragmatism",
    adjective: "pragmatist",
    name: "Pragmatism",
    tradition: "Dewey, Logic: The Theory of Inquiry (1938); Morgan (2007)",
    gloss:
      "The research question decides the method, and a combination is legitimate if it answers the question better than either half would.",
    ontology: "pluralist",
    epistemology: "pragmatic",
    design: "either",
    sampling: "either",
    methods: ["mixed methods", "action research", "design research", "survey", "interview"],
    dataTypes: ["numeric measures", "transcripts", "observational records"],
    analyticMoves: ["integration at a stated join", "sequential explanation", "triangulation"],
  },
  critical_theory: {
    id: "critical_theory",
    adjective: "critical-theoretical",
    name: "Critical theory",
    tradition: "Horkheimer, Traditional and Critical Theory (1937); Habermas (1968)",
    gloss:
      "Description is not enough: research should expose the arrangements that keep some people subordinate, and be judged partly by whether it helps change them.",
    ontology: "stratified",
    epistemology: "transactional",
    design: "emergent",
    sampling: "purposive",
    methods: ["critical ethnography", "critical discourse analysis", "participatory action research"],
    dataTypes: ["transcripts", "media texts", "policy documents", "institutional records"],
    analyticMoves: ["ideology critique", "power mapping", "historical contextualisation"],
  },
  feminist_theory: {
    id: "feminist_theory",
    adjective: "feminist",
    name: "Feminist theory",
    tradition: "Harding, Whose Science? Whose Knowledge? (1991); Haraway, Situated Knowledges (1988)",
    gloss:
      "Who is doing the knowing shapes what is known, so the researcher's position is part of the method rather than something to be scrubbed out.",
    ontology: "stratified",
    epistemology: "transactional",
    design: "emergent",
    sampling: "purposive",
    methods: ["feminist interview", "oral history", "institutional ethnography", "standpoint analysis"],
    dataTypes: ["transcripts", "life histories", "institutional texts"],
    analyticMoves: ["standpoint analysis", "reflexive positioning", "intersectional reading"],
  },
  symbolic_interactionism: {
    id: "symbolic_interactionism",
    adjective: "symbolic-interactionist",
    name: "Symbolic interactionism",
    tradition: "Blumer, Symbolic Interactionism (1969), after Mead, Mind, Self and Society (1934)",
    gloss:
      "People act towards things according to what those things mean to them, and those meanings are worked out and revised in interaction.",
    ontology: "relativist",
    epistemology: "subjectivist",
    design: "emergent",
    sampling: "purposive",
    methods: ["participant observation", "ethnography", "in-depth interview"],
    dataTypes: ["field notes", "interaction transcripts", "naturally occurring talk"],
    analyticMoves: ["situational analysis", "identity work analysis", "negotiated-order mapping"],
  },
  phenomenology: {
    id: "phenomenology",
    adjective: "phenomenological",
    name: "Phenomenology",
    tradition: "Husserl, Ideas (1913); Giorgi (2009); van Manen, Researching Lived Experience (1990)",
    gloss:
      "The aim is to describe what an experience is actually like for the people who lived it, setting aside what we assume it must be like.",
    ontology: "relativist",
    epistemology: "subjectivist",
    design: "emergent",
    sampling: "purposive",
    methods: ["phenomenological interview", "written experiential accounts"],
    dataTypes: ["transcripts of lived-experience accounts", "reflective writing"],
    analyticMoves: ["bracketing", "horizonalisation", "essence statement"],
  },
  grounded_theory: {
    id: "grounded_theory",
    adjective: "grounded-theory",
    name: "Grounded theory",
    tradition: "Glaser & Strauss, The Discovery of Grounded Theory (1967); Charmaz (2006)",
    gloss:
      "Build the theory out of the data rather than testing one brought to it, sampling further as the emerging categories demand.",
    ontology: "relativist",
    epistemology: "transactional",
    design: "emergent",
    sampling: "purposive",
    methods: ["theoretical sampling", "iterative interviewing", "constant comparison"],
    dataTypes: ["transcripts", "field notes", "memos"],
    analyticMoves: ["open coding", "axial coding", "selective coding", "theoretical saturation"],
  },
  hermeneutics: {
    id: "hermeneutics",
    adjective: "hermeneutic",
    name: "Hermeneutics",
    tradition: "Gadamer, Truth and Method (1960); Ricoeur (1981)",
    gloss:
      "Understanding a text means moving repeatedly between its parts and its whole, and being honest that you come to it with expectations.",
    ontology: "relativist",
    epistemology: "subjectivist",
    design: "emergent",
    sampling: "purposive",
    methods: ["textual interpretation", "historical analysis", "close reading"],
    dataTypes: ["texts", "documents", "archival material"],
    analyticMoves: ["the hermeneutic circle", "fusion of horizons", "prejudice disclosure"],
  },
  critical_realism: {
    id: "critical_realism",
    adjective: "critical realist",
    name: "Critical realism",
    tradition: "Bhaskar, A Realist Theory of Science (1975); Sayer, Realism and Social Science (2000)",
    gloss:
      "Real structures exist and generate what we observe, but our access to them is always through fallible interpretation — so explanation means naming the mechanism, not just the pattern.",
    ontology: "stratified",
    epistemology: "transactional",
    design: "either",
    sampling: "purposive",
    methods: ["intensive case study", "mixed methods", "process tracing"],
    dataTypes: ["case material", "numeric indicators", "interviews"],
    analyticMoves: ["retroduction", "mechanism identification", "demi-regularity analysis"],
  },
  postmodernism: {
    id: "postmodernism",
    adjective: "postmodernist",
    name: "Postmodernism",
    tradition: "Lyotard, The Postmodern Condition (1979); Foucault, The Archaeology of Knowledge (1969)",
    gloss:
      "Grand explanations of everything are treated with suspicion; the interest is in how particular accounts came to count as true.",
    ontology: "relativist",
    epistemology: "subjectivist",
    design: "emergent",
    sampling: "purposive",
    methods: ["deconstruction", "genealogy", "discourse analysis"],
    dataTypes: ["texts", "media artefacts", "institutional discourse"],
    analyticMoves: ["deconstruction", "genealogical tracing", "reading for silences"],
  },
  social_constructionism: {
    id: "social_constructionism",
    adjective: "social constructionist",
    name: "Social constructionism",
    tradition: "Berger & Luckmann, The Social Construction of Reality (1966); Gergen (1985)",
    gloss:
      "Categories we treat as natural — a diagnosis, a race, a crisis — are produced and maintained in talk and institutions, and can be studied as such.",
    ontology: "relativist",
    epistemology: "transactional",
    design: "emergent",
    sampling: "purposive",
    methods: ["discourse analysis", "conversation analysis", "documentary analysis"],
    dataTypes: ["naturally occurring talk", "media texts", "institutional records"],
    analyticMoves: ["category analysis", "tracing institutionalisation", "reification critique"],
  },
  realism: {
    id: "realism",
    adjective: "realist",
    name: "Realism",
    tradition: "Pawson & Tilley, Realistic Evaluation (1997); Maxwell, A Realist Approach (2012)",
    gloss:
      "Things exist independently of what we think about them, and the useful question is what works, for whom, in which circumstances.",
    ontology: "realist",
    epistemology: "objectivist",
    design: "either",
    sampling: "either",
    methods: ["realist evaluation", "case study", "survey", "systematic review"],
    dataTypes: ["outcome measures", "case material", "programme documentation"],
    analyticMoves: ["context–mechanism–outcome configuration", "middle-range theorising"],
  },
};
