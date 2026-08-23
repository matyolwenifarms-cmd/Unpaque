import { useState } from "react";
import type { StudiesState } from "@/hooks/useStudies.ts";
import { cn } from "@/lib/utils.ts";

/**
 * Which study every stage below is working within.
 *
 * At the top of Research rather than inside one stage, because a study is the
 * whole piece of research: its transcripts, its codebook, its method
 * declaration, its analyses and its reading list. A picker that lived in the
 * coding stage would let somebody declare a methodology against one study and
 * code another.
 */
export function StudyBar({ studies }: { studies: StudiesState }) {
  const [naming, setNaming] = useState(false);
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");

  async function start(event: React.FormEvent) {
    event.preventDefault();
    if (title.trim() === "") return;
    await studies.start(title, question);
    setTitle("");
    setQuestion("");
    setNaming(false);
  }

  return (
    <div className="mb-6 space-y-3">
      {studies.invitations.map((invitation) => (
        <section key={invitation.study_id} className="rounded-lg border border-rule bg-raised p-4">
          <h3 className="text-sm font-medium">
            You have been invited to code &ldquo;{invitation.title}&rdquo;
          </h3>
          <p className="mt-1 text-sm text-muted">
            {invitation.invited_by_email
              ? `${invitation.invited_by_email} asked you to apply their codebook to their transcripts.`
              : "Somebody asked you to apply their codebook to their transcripts."}{" "}
            You will not see anybody else&rsquo;s codings while the study is blind, which is what
            makes the comparison worth making.
          </p>
          <button
            type="button"
            onClick={() => void studies.accept(invitation)}
            className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
          >
            Accept
          </button>
        </section>
      ))}

      {studies.studies !== null && (
        <section className="rounded-lg border border-rule bg-raised p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="mr-auto text-sm font-medium">Your studies</h3>
            {studies.studyId !== null && (
              <button
                type="button"
                onClick={() => studies.open(null)}
                className="rounded-lg border border-rule px-3 py-1.5 text-xs hover:border-accent"
              >
                Close study
              </button>
            )}
            <button
              type="button"
              onClick={() => setNaming((was) => !was)}
              className="rounded-lg border border-rule px-3 py-1.5 text-xs hover:border-accent"
            >
              {naming ? "Cancel" : "New study"}
            </button>
          </div>

          {studies.studies.length === 0 && !naming && (
            <p className="text-sm text-muted">
              A study holds one piece of research — its transcripts, its codebook, the method you
              declared, the analyses you ran and the sources you kept. Start one and all of it is
              kept.
            </p>
          )}

          {studies.studies.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {studies.studies.map((study) => (
                <li key={study.id}>
                  <button
                    type="button"
                    aria-pressed={studies.studyId === study.id}
                    onClick={() => studies.open(study.id)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs",
                      studies.studyId === study.id
                        ? "border-accent bg-accent/10"
                        : "border-rule hover:border-accent",
                    )}
                  >
                    {study.title}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {naming && (
            <form onSubmit={start} className="mt-3">
              <label htmlFor="study-title" className="mb-1 block text-xs text-muted">
                What is the study called?
              </label>
              <input
                id="study-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mb-3 w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <label htmlFor="study-question" className="mb-1 block text-xs text-muted">
                The research question (optional)
              </label>
              <input
                id="study-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                className="mb-3 w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={title.trim() === ""}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-40"
              >
                Start study
              </button>
            </form>
          )}
        </section>
      )}

      {studies.problem && (
        <p className="rounded-lg border border-rule bg-raised p-3 text-sm" role="alert">
          {studies.problem}
        </p>
      )}
    </div>
  );
}
