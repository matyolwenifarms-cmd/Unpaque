import type { DiagnosticReport, Mode } from "./report.ts";

// A fixed report, returned when UNPAQUE_MODEL=stub, so the interface, the
// endpoint, the rate limiter and the client can all be exercised without
// spending anything on a model call.
//
// House rule: a placeholder must announce itself. This one does not analyse the
// submitted text and must never appear to. The response carries `stub: true`,
// the UI renders a banner saying so, and the prose below says it in the first
// sentence of the first section a reader's eye lands on. A stub a producer can
// mistake for output is worse than no stub, because it converts "the tool is
// not wired up yet" into "the tool is bad at its job".
//
// It is written to pass parseReport() and guardReport() unmodified — if the
// contract or the boundary changes, the tests below fail and this has to be
// brought along too.

export function stubReport(mode: Mode): DiagnosticReport {
  const report: DiagnosticReport = {
    mode,
    sections: [
      {
        id: "act",
        summary:
          "This is a fixed example, not an analysis: Unpack has not read the text you submitted. It is here so the interface can be checked without a model call.",
        findings: [
          {
            framework: "speech_act",
            claim:
              "In a real report this names the act the text performs and any secondary act carried alongside it — a refusal delivered as a statement of constraint, for instance, rather than as a decline.",
            quotes: ["a verbatim span of your text would appear here"],
          },
        ],
      },
      {
        id: "responsibility",
        summary: "A real report places the text's account of cause: in the writer, in another party, or in circumstance.",
        findings: [
          {
            framework: "attribution",
            claim:
              "Where a clause names no actor, the grammar itself is the finding — an outcome that arrives rather than a decision somebody took.",
            quotes: [],
          },
        ],
      },
      {
        id: "framing",
        summary: "A real report names what has been made salient, and what a reader would need to already know to notice an omission.",
        findings: [],
      },
      {
        id: "ambiguity",
        summary: "A real report names the phrasing that resists being pinned down, and what stays uncommitted as a result.",
        findings: [
          {
            framework: "strategic_ambiguity",
            claim: "A commitment left unquantified — no date, no threshold, no named condition — is the usual shape.",
            quotes: [],
          },
        ],
      },
    ],
  };

  if (mode === "draft") {
    report.rewrite = {
      text: "A real rewrite would appear here: your message, restructured so the commitments read as commitments and the request reads as a request. Its wording would be yours, not Unpack's.",
      note: "The note explains what changed structurally and why. This one is fixed text and explains nothing about your draft.",
    };
  }

  return report;
}
