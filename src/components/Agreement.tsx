import { useMemo, useState } from "react";
import type { Code } from "@shared/research/qualitative/codebook.ts";
import type { Coding } from "@shared/research/qualitative/coding.ts";
import {
  agreementBetween,
  conventionalLabel,
  reportKappa,
} from "@shared/research/qualitative/agreement.ts";
import { UNIT_KINDS, type UnitKind } from "@shared/research/qualitative/units.ts";
import { cn } from "@/lib/utils.ts";

/**
 * Inter-coder agreement, and the two things that have to be true before it
 * means anything.
 *
 * The first is that the coders worked independently, which is what blinding
 * is for and why this screen refuses to compute anything while a study is
 * still blind. The second is that they were rating the same units — coders
 * choose their own spans, so the document is divided first and both coders'
 * work is read against that division.
 */
export function Agreement({
  codes,
  codings,
  documents,
  coders,
  blind,
  isOwner,
  onUnblind,
}: {
  codes: readonly Code[];
  codings: readonly Coding[];
  /** Document id to its text. */
  documents: ReadonlyMap<string, string>;
  /** Everybody who has applied at least one code, by id and label. */
  coders: ReadonlyArray<{ id: string; name: string }>;
  blind: boolean;
  isOwner: boolean;
  onUnblind: () => void;
}) {
  const [unitKind, setUnitKind] = useState<UnitKind>("paragraph");
  const [first, setFirst] = useState(coders[0]?.id ?? "");
  const [second, setSecond] = useState(coders[1]?.id ?? "");

  const outcome = useMemo(
    () =>
      first && second
        ? agreementBetween(first, second, codes, codings, documents, unitKind)
        : null,
    [first, second, codes, codings, documents, unitKind],
  );

  const nameOf = (id: string) => coders.find((coder) => coder.id === id)?.name ?? id;

  if (blind) {
    return (
      <section className="rounded-lg border border-rule bg-raised p-4">
        <h4 className="mb-2 text-sm font-medium">This study is still blind</h4>
        <p className="text-sm text-muted">
          Every coder sees only their own codings, which is what makes the comparison worth making:
          a second coder who can see the first coder&rsquo;s highlights reaches the same passages
          because they were shown them, and the figure that comes out measures nothing.
        </p>
        {isOwner ? (
          <>
            <p className="mt-3 text-sm text-muted">
              Unblinding shows every coder&rsquo;s work to every coder. It cannot be undone —
              nobody can be made to unsee — so do it when the independent coding is finished.
            </p>
            <button
              type="button"
              onClick={onUnblind}
              className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
            >
              Unblind, and compare
            </button>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted">
            The owner of this study unblinds it when the coding is done.
          </p>
        )}
      </section>
    );
  }

  if (coders.length < 2) {
    return (
      <section className="rounded-lg border border-rule bg-raised p-4">
        <h4 className="mb-2 text-sm font-medium">Only one person has coded this study</h4>
        <p className="text-sm text-muted">
          Agreement is between two coders. Invite one under Coders, and let them work through the
          transcripts before unblinding.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-rule bg-raised p-4">
        <h4 className="mb-3 text-sm font-medium">What is being compared</h4>
        <div className="grid gap-3 sm:grid-cols-3">
          <Pick id="agreement-first" label="First coder" value={first} onChange={setFirst}
                options={coders.map((coder) => ({ value: coder.id, label: coder.name }))} />
          <Pick id="agreement-second" label="Second coder" value={second} onChange={setSecond}
                options={coders.map((coder) => ({ value: coder.id, label: coder.name }))} />
          <Pick
            id="agreement-unit"
            label="Unit of analysis"
            value={unitKind}
            onChange={(value) => setUnitKind(value as UnitKind)}
            options={UNIT_KINDS.map((kind) => ({ value: kind.id, label: kind.name }))}
          />
        </div>
        {/* Said here rather than in a footnote, because the choice changes
            every number below it. */}
        <p className="mt-3 text-xs text-muted">
          {UNIT_KINDS.find((kind) => kind.id === unitKind)?.blurb} Kappa compares two people rating
          the same units, so the transcripts are divided first and each coder&rsquo;s spans are read
          against that division — a unit counts as coded if any of their selections touches it.
        </p>
      </section>

      {outcome?.kind === "not_possible" && (
        <p className="rounded-lg border border-rule bg-raised p-4 text-sm text-muted">
          {outcome.says}
        </p>
      )}

      {outcome?.kind === "read" && (
        <>
          <p className="text-sm text-muted">
            {outcome.units} {unitKind === "paragraph" ? "paragraphs" : "lines"} across{" "}
            {documents.size} transcript{documents.size === 1 ? "" : "s"}, comparing{" "}
            {nameOf(first)} and {nameOf(second)}.
          </p>

          {outcome.agreements.map((agreement) => {
            const code = codes.find((candidate) => candidate.id === agreement.codeId);
            return (
              <article
                key={agreement.codeId}
                className="rounded-lg border border-rule bg-raised p-4"
              >
                <h5 className="text-sm font-medium">{code?.label ?? agreement.codeId}</h5>

                {agreement.kind === "undefined" ? (
                  <p className="mt-1 text-sm text-muted">{agreement.says}</p>
                ) : (
                  <>
                    <p className="mt-1 font-serif text-sm">
                      {reportKappa(agreement, unitKind)}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Landis and Koch&rsquo;s 1977 labels call that{" "}
                      <span className="text-ink">{conventionalLabel(agreement.kappa)}</span>. They
                      are a convention rather than a standard, and their author offered the
                      cut-offs as arbitrary — the interval above is the part to report.
                    </p>

                    <table className="mt-3 w-full max-w-md text-xs">
                      <caption className="sr-only">
                        Units by whether each coder applied {code?.label ?? "the code"}
                      </caption>
                      <thead>
                        <tr className="border-b border-rule text-left text-muted">
                          <th scope="col" className="pb-1 font-normal" />
                          <th scope="col" className="pb-1 text-right font-normal">
                            {nameOf(second)} applied
                          </th>
                          <th scope="col" className="pb-1 text-right font-normal">
                            did not
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-rule/50">
                          <th scope="row" className="py-1 text-left font-normal text-muted">
                            {nameOf(first)} applied
                          </th>
                          <td className="py-1 text-right">{agreement.table.both}</td>
                          <td className="py-1 text-right">{agreement.table.firstOnly}</td>
                        </tr>
                        <tr>
                          <th scope="row" className="py-1 text-left font-normal text-muted">
                            did not
                          </th>
                          <td className="py-1 text-right">{agreement.table.secondOnly}</td>
                          <td className="py-1 text-right">{agreement.table.neither}</td>
                        </tr>
                      </tbody>
                    </table>

                    {agreement.interval.kind === "degenerate" && (
                      <p className="mt-3 text-sm text-muted">{agreement.interval.says}</p>
                    )}

                    {agreement.cautions.map((caution) => (
                      <p key={caution} className="mt-3 text-sm text-muted">
                        {caution}
                      </p>
                    ))}
                  </>
                )}
              </article>
            );
          })}
        </>
      )}
    </div>
  );
}

function Pick({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none",
          "focus:border-accent",
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
