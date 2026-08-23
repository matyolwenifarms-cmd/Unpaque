import { useCallback, useEffect, useState } from "react";
import type { Code } from "@shared/research/qualitative/codebook.ts";
import type { Coding } from "@shared/research/qualitative/coding.ts";
import type { ThemeDraft } from "@shared/research/qualitative/themes.ts";
import * as api from "@/lib/qualitative-api.ts";
import type { CoderRow } from "@/lib/qualitative-api.ts";

export interface WorkingDocument {
  id: string;
  name: string;
  body: string;
}

export interface QualitativeStore {
  documents: WorkingDocument[];
  codes: Code[];
  codings: Coding[];
  drafts: ThemeDraft[];
  /** Everybody invited to code, whether or not they have accepted. */
  coders: CoderRow[];
  /** True while the first load is in flight. Only ever true when kept. */
  loading: boolean;
  /** Whether any of this survives the tab closing. */
  kept: boolean;
  problem: string | null;
  addDocument: (name: string, body: string) => Promise<void>;
  moveDocument: (id: string, by: -1 | 1) => Promise<void>;
  addCode: (code: Omit<Code, "id">) => Promise<void>;
  removeCode: (id: string) => Promise<void>;
  applyCoding: (coding: Omit<Coding, "id">) => Promise<void>;
  removeCoding: (id: string) => Promise<void>;
  addDraft: (draft: Omit<ThemeDraft, "id">) => Promise<void>;
  removeDraft: (id: string) => Promise<void>;
  invite: (email: string) => Promise<void>;
  uninvite: (email: string) => Promise<void>;
}

/**
 * The qualitative workspace, kept or not kept.
 *
 * One hook rather than two code paths through the screen. Passed a study id it
 * loads from Postgres and mirrors every write there; passed null it holds
 * everything in memory and says so. The components above it cannot tell the
 * difference, which is the point: a second rendering path for the unsaved case
 * is a second place for the coding surface to be subtly wrong, and the unsaved
 * case is the one nobody would test.
 *
 * Writes are awaited rather than optimistic. A coding is a hundred
 * milliseconds and reconciling an optimistic list against a refusal — a code
 * deleted in another tab, a session that expired mid-session — costs more
 * correctness than it buys responsiveness. The one thing that must never
 * happen here is the screen showing a coding the database refused.
 */
export function useQualitativeStudy(studyId: string | null): QualitativeStore {
  const [documents, setDocuments] = useState<WorkingDocument[]>([]);
  const [codes, setCodes] = useState<Code[]>([]);
  const [codings, setCodings] = useState<Coding[]>([]);
  const [drafts, setDrafts] = useState<ThemeDraft[]>([]);
  const [coders, setCoders] = useState<CoderRow[]>([]);
  const [loading, setLoading] = useState(studyId !== null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    setDocuments([]);
    setCodes([]);
    setCodings([]);
    setDrafts([]);
    setCoders([]);
    setProblem(null);

    if (studyId === null) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    void api.loadStudy(studyId).then((result) => {
      if (!active) return;
      if (!result.ok) {
        setProblem(result.message);
      } else {
        setDocuments(result.data.documents.map(({ id, name, body }) => ({ id, name, body })));
        setCodes(result.data.codes);
        setCodings(result.data.codings);
        setDrafts(result.data.drafts);
      }
      setLoading(false);
    });
    void api.listCoders(studyId).then((result) => {
      if (active && result.ok) setCoders(result.data);
    });
    return () => {
      active = false;
    };
  }, [studyId]);

  const addDocument = useCallback(
    async (name: string, body: string) => {
      if (studyId === null) {
        setDocuments((was) => [...was, { id: crypto.randomUUID(), name, body }]);
        return;
      }
      // Positions are 1-based and dense, which `set_coding_order` also assumes.
      const result = await api.addDocument(studyId, name, body, documents.length + 1);
      if (!result.ok) return setProblem(result.message);
      setProblem(null);
      setDocuments((was) => [...was, { id: result.data.id, name, body }]);
    },
    [studyId, documents.length],
  );

  const moveDocument = useCallback(
    async (id: string, by: -1 | 1) => {
      const from = documents.findIndex((document) => document.id === id);
      const to = from + by;
      if (from < 0 || to < 0 || to >= documents.length) return;
      const next = [...documents];
      [next[from], next[to]] = [next[to]!, next[from]!];

      if (studyId !== null) {
        const result = await api.setCodingOrder(studyId, next.map((document) => document.id));
        if (!result.ok) return setProblem(result.message);
      }
      setProblem(null);
      setDocuments(next);
    },
    [studyId, documents],
  );

  const addCode = useCallback(
    async (code: Omit<Code, "id">) => {
      if (studyId === null) {
        setCodes((was) => [...was, { ...code, id: crypto.randomUUID() }]);
        return;
      }
      const result = await api.addCode(studyId, { ...code, id: crypto.randomUUID() });
      if (!result.ok) return setProblem(result.message);
      setProblem(null);
      setCodes((was) => [...was, result.data]);
    },
    [studyId],
  );

  const removeCode = useCallback(
    async (id: string) => {
      if (studyId !== null) {
        const result = await api.removeCode(id);
        if (!result.ok) return setProblem(result.message);
      }
      setProblem(null);
      setCodes((was) => was.filter((code) => code.id !== id));
      // The codings go with it, in the database by cascade and here by hand.
      // Leaving them would put extracts on screen under a code that no longer
      // has a definition, which is the state a codebook exists to prevent.
      setCodings((was) => was.filter((coding) => coding.codeId !== id));
      setDrafts((was) =>
        was.map((draft) => ({ ...draft, codeIds: draft.codeIds.filter((codeId) => codeId !== id) })),
      );
    },
    [studyId],
  );

  const applyCoding = useCallback(
    async (coding: Omit<Coding, "id">) => {
      if (studyId === null) {
        setCodings((was) => [...was, { ...coding, id: crypto.randomUUID() }]);
        return;
      }
      const result = await api.applyCoding(
        coding.documentId,
        coding.codeId,
        coding.start,
        coding.end,
        coding.memo ?? null,
      );
      if (!result.ok) return setProblem(result.message);
      setProblem(null);
      setCodings((was) => [...was, { ...coding, id: result.data }]);
    },
    [studyId],
  );

  const removeCoding = useCallback(
    async (id: string) => {
      if (studyId !== null) {
        const result = await api.removeCoding(id);
        if (!result.ok) return setProblem(result.message);
      }
      setProblem(null);
      setCodings((was) => was.filter((coding) => coding.id !== id));
    },
    [studyId],
  );

  const addDraft = useCallback(
    async (draft: Omit<ThemeDraft, "id">) => {
      if (studyId === null) {
        setDrafts((was) => [...was, { ...draft, id: crypto.randomUUID() }]);
        return;
      }
      const result = await api.addThemeDraft(studyId, draft);
      if (!result.ok) return setProblem(result.message);
      setProblem(null);
      setDrafts((was) => [...was, result.data]);
    },
    [studyId],
  );

  const removeDraft = useCallback(
    async (id: string) => {
      if (studyId !== null) {
        const result = await api.removeThemeDraft(id);
        if (!result.ok) return setProblem(result.message);
      }
      setProblem(null);
      setDrafts((was) => was.filter((draft) => draft.id !== id));
    },
    [studyId],
  );

  const invite = useCallback(
    async (email: string) => {
      if (studyId === null) return;
      const result = await api.inviteCoder(studyId, email);
      if (!result.ok) return setProblem(result.message);
      setProblem(null);
      const listed = await api.listCoders(studyId);
      if (listed.ok) setCoders(listed.data);
    },
    [studyId],
  );

  const uninvite = useCallback(
    async (email: string) => {
      if (studyId === null) return;
      const result = await api.removeCoder(studyId, email);
      if (!result.ok) return setProblem(result.message);
      setProblem(null);
      setCoders((was) => was.filter((coder) => coder.email !== email));
    },
    [studyId],
  );

  return {
    documents,
    codes,
    codings,
    drafts,
    coders,
    loading,
    kept: studyId !== null,
    problem,
    addDocument,
    moveDocument,
    addCode,
    removeCode,
    applyCoding,
    removeCoding,
    addDraft,
    removeDraft,
    invite,
    uninvite,
  };
}
