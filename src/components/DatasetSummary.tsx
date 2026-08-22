import type { Dataset } from "@shared/research/analytics/dataset.ts";

/**
 * What was read, before anything is computed on it.
 *
 * Shown first and always. The commonest way a quantitative analysis goes wrong
 * is not the test — it is that the file was not what the researcher thought:
 * a column read as text because one cell says "N/A", 340 rows where there
 * should be 400, a grouping variable with three levels because somebody typed
 * "Female" and "female". All three are visible here in a glance and invisible
 * in a results table.
 */
export function DatasetSummary({ dataset }: { dataset: Dataset }) {
  return (
    <section aria-labelledby="dataset" className="rounded-lg border border-rule bg-raised p-5">
      <h3 id="dataset" className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">
        What was read
      </h3>
      <p className="mb-4 text-sm text-muted">
        {dataset.rows} row{dataset.rows === 1 ? "" : "s"}, {dataset.columns.length} column
        {dataset.columns.length === 1 ? "" : "s"}.
      </p>

      {dataset.notes.length > 0 && (
        <ul className="mb-4 space-y-1 text-sm text-muted">
          {dataset.notes.map((note, index) => (
            <li key={index}>{note}</li>
          ))}
        </ul>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted">
            <tr>
              <th scope="col" className="pb-2 pr-4 font-medium">Column</th>
              <th scope="col" className="pb-2 pr-4 font-medium">Read as</th>
              <th scope="col" className="pb-2 pr-4 font-medium">Usable</th>
              <th scope="col" className="pb-2 pr-4 font-medium">Missing</th>
              <th scope="col" className="pb-2 font-medium">Values</th>
            </tr>
          </thead>
          <tbody>
            {dataset.columns.map((column) => (
              <tr key={column.name} className="border-t border-rule">
                <th scope="row" className="py-2 pr-4 font-medium">{column.name}</th>
                <td className="py-2 pr-4 text-muted">{column.kind}</td>
                <td className="py-2 pr-4">{column.n}</td>
                <td className="py-2 pr-4">
                  {/* An absence is a number, not a blank. A column with 60
                      missing values needs to look different from one with none,
                      and an empty cell reads as "nothing to report". */}
                  {column.missing > 0 ? column.missing : "—"}
                </td>
                <td className="py-2 text-muted">
                  {column.kind === "categorical" && column.levels
                    ? column.levels.slice(0, 4).map((level) => `${level.value} (${level.count})`)
                        .join(", ") + (column.distinct > 4 ? `, +${column.distinct - 4} more` : "")
                    : column.kind === "numeric"
                      ? `${column.distinct} distinct`
                      : column.kind === "empty"
                        ? "nothing in this column"
                        : `${column.distinct} distinct — too many to be a variable`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
