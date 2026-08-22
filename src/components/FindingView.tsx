import { describeFinding, type AssumptionCheck, type Finding } from "@shared/research/analytics/result.ts";
import { familyOf } from "@shared/research/analytics/corrections.ts";
import { cn } from "@/lib/utils.ts";

/**
 * A finding, with everything that qualifies it in the same view.
 *
 * The sentence comes from `describeFinding`, not from this component. The
 * wording is where a result gets overstated — "no difference" for a failure to
 * reject, an asterisk with no effect size — so it is generated in one tested
 * place rather than assembled out of fields by whatever is rendering it.
 *
 * The assumptions are not collapsed behind a disclosure. An unmet assumption
 * one click away from a p-value is an unmet assumption nobody reads.
 */
export function FindingView({ finding }: { finding: Finding }) {
  const family = familyOf(finding.comparisons);
  const unmet = finding.assumptions.filter((check) => check.status === "unmet");

  return (
    <section aria-labelledby="finding" className="rounded-lg border border-rule bg-raised p-5">
      <h3 id="finding" className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
        {finding.test}
      </h3>

      <p className="mb-4 text-[1.05rem] leading-relaxed">{describeFinding(finding)}</p>

      <dl className="mb-5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <Stat label="n" value={String(finding.n)} />
        <Stat
          label={finding.effect.kind.replace(/_/g, " ")}
          value={`${round(finding.effect.value)}${finding.effect.magnitude ? ` (${finding.effect.magnitude})` : ""}`}
        />
        <Stat
          label={`${Math.round(finding.interval.level * 100)}% CI`}
          value={`${round(finding.interval.lower)} to ${round(finding.interval.upper)}`}
        />
        <Stat label="p" value={finding.p < 0.001 ? "< .001" : finding.p.toFixed(3).replace(/^0/, "")} />
      </dl>

      {finding.comparisons > 1 && (
        <p className="mb-5 rounded-md border border-rule bg-paper p-3 text-sm leading-relaxed">
          {family.says}
        </p>
      )}

      <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
        Assumptions {unmet.length > 0 && <span className="text-accent">— {unmet.length} not met</span>}
      </h4>
      <ul className="space-y-3">
        {finding.assumptions.map((check, index) => (
          <AssumptionRow key={index} check={check} />
        ))}
      </ul>
    </section>
  );
}

function AssumptionRow({ check }: { check: AssumptionCheck }) {
  return (
    <li className="border-t border-rule pt-3 first:border-t-0 first:pt-0">
      <p className="text-sm">
        <span
          className={cn(
            "mr-2 rounded px-1.5 py-0.5 text-xs uppercase tracking-wider",
            // `destructive` red is for something wrong or about to be. An
            // unmet assumption is a fact about the data that the researcher
            // may well have a good answer for, and `not_assessable` is not a
            // problem at all — it is the honest state for independence, which
            // no statistic can recover.
            check.status === "unmet"
              ? "bg-accent/20 text-accent"
              : "bg-paper text-muted",
          )}
        >
          {check.status === "met" ? "met" : check.status === "unmet" ? "not met" : "unknown"}
        </span>
        <span className="font-medium">{check.name}</span>
      </p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{check.detail}</p>
      {check.remedy && <p className="mt-1 text-sm leading-relaxed text-muted">{check.remedy}</p>}
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

function round(value: number, places = 3): string {
  if (!Number.isFinite(value)) return "—";
  return String(Math.round(value * 10 ** places) / 10 ** places);
}
