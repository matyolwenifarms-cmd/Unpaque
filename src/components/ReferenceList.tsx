import { AlertTriangle, ExternalLink, FileText, Info } from "lucide-react";
import type { SearchedReference } from "@/lib/research-api.ts";
import { cn } from "@/lib/utils.ts";

function authorLine(reference: SearchedReference): string {
  const names = reference.authors.map((author) => author.name);
  if (names.length === 0) return "No authors listed";
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} and ${names.length - 3} others`;
}

/**
 * A caveat is rendered in a colour that matches its seriousness, and retraction
 * is the only one that gets `destructive`. An accepted manuscript is a thing to
 * know, not a thing that is wrong — colouring both the same teaches a reader to
 * skim past the one that matters.
 */
function Caveat({ text, severe }: { text: string; severe: boolean }) {
  return (
    <p
      className={cn(
        "mt-2 flex items-start gap-1.5 rounded-md px-2 py-1.5 text-sm",
        severe
          ? "bg-red-500/10 font-medium text-red-700 dark:text-red-400"
          : "bg-paper text-muted",
      )}
    >
      {severe ? (
        <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <span>{text}</span>
    </p>
  );
}

export function ReferenceList({ references }: { references: SearchedReference[] }) {
  return (
    <ol className="space-y-3">
      {references.map((reference) => {
        const severe = reference.retraction !== "none" || reference.verification === "unresolvable";
        return (
          <li key={reference.id} className="rounded-lg border border-rule bg-raised p-4">
            <h3 className="font-medium leading-snug">{reference.title}</h3>

            <p className="mt-1 text-sm text-muted">
              {authorLine(reference)}
              {reference.year ? ` · ${reference.year}` : ""}
              {reference.venue ? ` · ${reference.venue}` : ""}
            </p>

            {reference.caveat && <Caveat text={reference.caveat} severe={severe} />}

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              {reference.doi && (
                <a
                  href={`https://doi.org/${reference.doi}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                >
                  <ExternalLink aria-hidden className="h-3 w-3" />
                  {reference.doi}
                </a>
              )}
              {reference.fullText && (
                <a
                  href={reference.fullText.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                >
                  <FileText aria-hidden className="h-3 w-3" />
                  Full text
                </a>
              )}
              {typeof reference.citedByCount === "number" && (
                <span className="text-muted">cited by {reference.citedByCount.toLocaleString("en-GB")}</span>
              )}
              {/* Provenance stays visible. Which sources agreed is part of how
                  much weight a reader should put on the row. */}
              <span className="text-muted">{reference.sources.join(" + ")}</span>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5",
                  reference.verification === "verified"
                    ? "bg-accent/15 text-accent"
                    : "bg-paper text-muted",
                )}
              >
                {reference.verification === "verified" ? "verified" : "unverified"}
              </span>
            </div>

            {reference.quotationCaveat && reference.availability === "full_text" && (
              <p className="mt-2 text-xs italic text-muted">{reference.quotationCaveat}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
