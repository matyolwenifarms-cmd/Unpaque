import { useCallback, useEffect, useState } from "react";
import {
  acceptInvitation,
  createStudy,
  listStudies,
  pendingInvitations,
  unblindStudy,
  type Invitation,
  type StudySummary,
} from "@/lib/qualitative-api.ts";
import { useSession } from "@/hooks/useSession.ts";

export interface StudiesState {
  studies: StudySummary[] | null;
  invitations: Invitation[];
  studyId: string | null;
  study: StudySummary | null;
  /** The signed-in user, or null. Needed to tell an owner from a coder. */
  userId: string | null;
  isOwner: boolean;
  problem: string | null;
  open: (id: string | null) => void;
  start: (title: string, question: string) => Promise<void>;
  accept: (invitation: Invitation) => Promise<void>;
  unblind: () => Promise<void>;
}

/**
 * The study every stage of Research works within.
 *
 * Lifted out of the coding workspace, which used to own it. That was right
 * while a study held only transcripts; it stopped being right the moment the
 * write-up needed the method declaration and the analyses, because those
 * belong to the same study and were being held in a different component's
 * state. Two containers for one piece of research is how a researcher ends up
 * with a methodology that does not match the coding it describes.
 */
export function useStudies(): StudiesState {
  const { session, configured } = useSession();
  const [studies, setStudies] = useState<StudySummary[] | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [studyId, setStudyId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const userId = session?.user?.id ?? null;

  useEffect(() => {
    if (!configured || !session) {
      setStudies(null);
      setStudyId(null);
      setInvitations([]);
      return;
    }
    let active = true;
    void pendingInvitations().then((result) => {
      if (active && result.ok) setInvitations(result.data);
    });
    void listStudies().then((result) => {
      if (!active) return;
      if (!result.ok) return setProblem(result.message);
      setProblem(null);
      setStudies(result.data);
      // Opened rather than offered when there is exactly one. A picker with a
      // single entry is a click that teaches nothing.
      if (result.data.length === 1) setStudyId(result.data[0]!.id);
    });
    return () => {
      active = false;
    };
  }, [configured, session]);

  const refresh = useCallback(async () => {
    const listed = await listStudies();
    if (listed.ok) setStudies(listed.data);
  }, []);

  const start = useCallback(
    async (title: string, question: string) => {
      const result = await createStudy(title, question);
      if (!result.ok) return setProblem(result.message);
      setProblem(null);
      setStudies((was) => [result.data, ...(was ?? [])]);
      setStudyId(result.data.id);
    },
    [],
  );

  const accept = useCallback(
    async (invitation: Invitation) => {
      const result = await acceptInvitation(invitation.study_id);
      if (!result.ok) return setProblem(result.message);
      setProblem(null);
      setInvitations((was) => was.filter((other) => other.study_id !== invitation.study_id));
      await refresh();
      setStudyId(invitation.study_id);
    },
    [refresh],
  );

  const unblind = useCallback(async () => {
    if (studyId === null) return;
    const result = await unblindStudy(studyId);
    if (!result.ok) return setProblem(result.message);
    setProblem(null);
    await refresh();
  }, [studyId, refresh]);

  const study = studies?.find((candidate) => candidate.id === studyId) ?? null;

  return {
    studies,
    invitations,
    studyId,
    study,
    userId,
    isOwner: study !== null && study.owner_id === userId,
    problem,
    open: setStudyId,
    start,
    accept,
    unblind,
  };
}
