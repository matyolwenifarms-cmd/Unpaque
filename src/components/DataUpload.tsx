import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { parseDataset, type Dataset } from "@shared/research/analytics/dataset.ts";
import { cn } from "@/lib/utils.ts";

/**
 * The file never leaves the browser.
 *
 * Read with FileReader and parsed here, not posted anywhere. That is a
 * deliberate property rather than an implementation detail: a research data set
 * is very often personal information about identifiable participants, held
 * under an ethics clearance that says where it may be stored. Uploading it to
 * a server so that the server can compute a mean would put Unpaque inside that
 * clearance, and every institution the researcher deals with would be right to
 * ask about it. The statistics are pure functions; they run wherever the data
 * already is.
 *
 * The interface says so, because a researcher cannot see where a file went and
 * the only reason to believe it is a sentence somebody wrote.
 */
export function DataUpload({
  onLoaded,
  fileName,
}: {
  onLoaded: (dataset: Dataset, name: string) => void;
  fileName: string | null;
}) {
  const [problem, setProblem] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function accept(file: File) {
    setProblem(null);
    const reader = new FileReader();
    reader.onerror = () => setProblem("That file could not be read.");
    reader.onload = () => {
      const outcome = parseDataset(String(reader.result ?? ""));
      if (!outcome.ok) {
        setProblem(outcome.reason);
        return;
      }
      onLoaded(outcome.dataset, file.name);
    };
    reader.readAsText(file);
  }

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          const file = event.dataTransfer.files[0];
          if (file) accept(file);
        }}
        className={cn(
          "rounded-lg border border-dashed p-8 text-center transition-colors",
          over ? "border-accent bg-accent/5" : "border-rule bg-raised",
        )}
      >
        <Upload aria-hidden className="mx-auto mb-3 h-6 w-6 text-muted" />
        <p className="mb-1">
          Drop a CSV here, or{" "}
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="font-medium text-accent hover:underline"
          >
            choose a file
          </button>
          .
        </p>
        <p className="text-xs text-muted">
          Comma, semicolon or tab delimited. Exports from Excel, SPSS, Qualtrics and Google Forms.
        </p>
        <input
          ref={input}
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
          aria-label="Data file"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) accept(file);
            // Cleared so choosing the same file twice fires onChange again —
            // which somebody will do after editing it in Excel.
            event.target.value = "";
          }}
        />
      </div>

      <p className="mt-2 text-xs text-muted">
        Your file is read in this browser and is not uploaded. Nothing here sends it anywhere.
      </p>

      {fileName && <p className="mt-2 text-sm">Loaded: <span className="font-medium">{fileName}</span></p>}
      {problem && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {problem}
        </p>
      )}
    </div>
  );
}
