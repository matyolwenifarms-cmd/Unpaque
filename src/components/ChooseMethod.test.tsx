// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PARADIGM_IDS } from "@shared/research/method/paradigms.ts";
import { THEORY_IDS } from "@shared/research/method/theories.ts";
import { ChooseMethod } from "./ChooseMethod.tsx";

describe("declaring a method", () => {
  it("offers every paradigm and every analytic approach", () => {
    render(<ChooseMethod />);
    const paradigms = screen.getByLabelText(/choose a paradigm/i) as HTMLSelectElement;
    const theories = screen.getByLabelText(/choose an analytic approach/i) as HTMLSelectElement;
    // Plus the "Choose…" and "None yet" placeholders.
    expect(paradigms.options).toHaveLength(PARADIGM_IDS.length + 1);
    expect(theories.options).toHaveLength(THEORY_IDS.length + 1);
  });

  // The gloss is what a first-year reads; the tradition is what a supervisor
  // checks. Both, because they are different readers of one screen.
  it("shows the plain sentence and the citation together", async () => {
    const user = userEvent.setup();
    render(<ChooseMethod />);
    await user.selectOptions(screen.getByLabelText(/choose a paradigm/i), "interpretivism");
    // Scoped to the paradigm panel: the gloss legitimately appears twice, once
    // here and once inside the statement below, and getAllByText would stop
    // asserting it is beside the control at all.
    const panel = screen.getByLabelText(/^paradigm$/i);
    expect(within(panel).getByText(/Social life is made of the meanings people give it/))
      .toBeInTheDocument();
    expect(within(panel).getByText(/Weber, Economy and Society \(1922\)/)).toBeInTheDocument();
  });

  it("shows nothing about a paradigm until one is chosen", () => {
    render(<ChooseMethod />);
    expect(screen.queryByLabelText(/methodology statement/i)).toBeNull();
  });
});

describe("the tensions", () => {
  async function declare(paradigm: string, theory?: string) {
    const user = userEvent.setup();
    render(<ChooseMethod />);
    await user.selectOptions(screen.getByLabelText(/choose a paradigm/i), paradigm);
    if (theory) await user.selectOptions(screen.getByLabelText(/choose an analytic approach/i), theory);
    return user;
  }

  // Told afterwards, a researcher has already committed to both.
  it("appear as the answers arrive, not on submit", async () => {
    await declare("positivism", "narrative_theory");
    const section = await screen.findByLabelText(/worth settling/i);
    expect(within(section).getByText(/treats knowledge as something measured from outside/))
      .toBeInTheDocument();
  });

  it("cite a source and offer a way through", async () => {
    await declare("positivism", "narrative_theory");
    const section = screen.getByLabelText(/worth settling/i);
    expect(within(section).getByText(/Guba & Lincoln/)).toBeInTheDocument();
    expect(within(section).getByText(/declare pragmatism or critical realism/)).toBeInTheDocument();
  });

  // Nothing blocks. Every one of these is defensible in some study, and the
  // page says so once, at the top, so the tone is not mistaken.
  it("say plainly that none of them stops you", async () => {
    await declare("positivism", "narrative_theory");
    expect(screen.getByText(/None of these stops you/)).toBeInTheDocument();
  });

  it("are absent for a design that hangs together", async () => {
    await declare("interpretivism", "narrative_theory");
    expect(screen.queryByLabelText(/worth settling/i)).toBeNull();
  });

  // Pragmatism exists partly to defend exactly this pairing.
  it("leave pragmatism alone", async () => {
    await declare("pragmatism", "technology_acceptance");
    expect(screen.queryByLabelText(/worth settling/i)).toBeNull();
  });

  it("still write the statement while a tension stands", async () => {
    await declare("positivism", "narrative_theory");
    const statement = screen.getByLabelText(/methodology statement/i);
    expect(statement.textContent).toMatch(/within a \*\*positivist\*\* paradigm/);
  });
});

describe("the statement", () => {
  it("appears once a paradigm is chosen and carries its citation", async () => {
    const user = userEvent.setup();
    render(<ChooseMethod />);
    await user.selectOptions(screen.getByLabelText(/choose a paradigm/i), "critical_realism");
    const statement = await screen.findByLabelText(/methodology statement/i);
    expect(statement.textContent).toMatch(/within a \*\*critical realist\*\* paradigm/);
    expect(statement.textContent).toMatch(/Bhaskar, A Realist Theory of Science \(1975\)/);
  });

  // A fluent paragraph the researcher did not write is worse than an obvious
  // gap, because the gap gets filled and the fluent paragraph gets marked.
  it("lists what is still theirs to write, and does not invent it", async () => {
    const user = userEvent.setup();
    render(<ChooseMethod />);
    await user.selectOptions(screen.getByLabelText(/choose a paradigm/i), "interpretivism");
    const statement = await screen.findByLabelText(/methodology statement/i);
    expect(statement.textContent).toMatch(/Still yours to write/);
    expect(statement.textContent).toMatch(/Ethics: approval, consent/);
    expect(statement.textContent).not.toMatch(/was chosen because|is appropriate because/i);
  });

  it("takes the design in and says it back", async () => {
    const user = userEvent.setup();
    render(<ChooseMethod />);
    await user.selectOptions(screen.getByLabelText(/choose a paradigm/i), "interpretivism");
    await user.selectOptions(screen.getByLabelText(/^sampling$/i), "purposive");
    await user.type(screen.getByLabelText(/sample size/i), "14");
    await user.type(screen.getByLabelText(/who they are/i), "journalists");
    await user.type(screen.getByLabelText(/how the data are collected/i), "semi-structured interviews");

    await waitFor(() => {
      const statement = screen.getByLabelText(/methodology statement/i);
      expect(statement.textContent).toMatch(/Sampling is purposive/);
      // Two sentences, not one. "comprises 14 journalists" was the earlier
      // form and it broke the moment somebody described their participants in
      // a phrase rather than a noun — "The sample comprises 2 Two people who
      // had been through the process.." was the first one generated.
      expect(statement.textContent).toMatch(/The sample comprises 14 participants: journalists\./);
      expect(statement.textContent).toMatch(/collected through semi-structured interviews/);
    });
  });

  it("holds an unrandomised causal question to association", async () => {
    const user = userEvent.setup();
    render(<ChooseMethod />);
    await user.selectOptions(screen.getByLabelText(/choose a paradigm/i), "post_positivism");
    await user.selectOptions(screen.getByLabelText(/the research question is/i), "causal");
    await waitFor(() =>
      expect(screen.getByLabelText(/methodology statement/i).textContent)
        .toMatch(/reported as association, not as cause/),
    );
  });
});
