'use client';

/**
 * R3 (USER_DRIVEN_ROADMAP) - autosave hook.
 *
 * Debounced capture of the live document into the working-copy slot,
 * plus a one-time recovery check on mount. Suppressed until the caller
 * signals the initial document load is done, so profile defaults and a
 * blank form never overwrite a recoverable copy before the user sees
 * the prompt.
 *
 * P6-4 (remediation 2026-09): one working copy per tab session. On
 * mount, every session's copy that carries content is offered, newest
 * first: other tabs' copies and this tab's own last one (a reload after
 * a crash keeps sessionStorage, so its id). Discard deletes only the
 * copy on offer; "keep for later" moves on without deleting - and when
 * the copy is this tab's own, the tab rotates to a fresh session id so
 * its next autosave does not overwrite what the user wanted to keep.
 *
 * A write that finds a newer copy under the same session id (a
 * duplicated tab writing in parallel) is refused, and this tab rotates
 * to its own session id so neither tab clobbers the other. The
 * BroadcastChannel announcement lets it learn that before the write.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { FormData, ParagraphData } from '@/types';
import {
  WorkingCopy,
  writeWorkingCopy,
  listWorkingCopies,
  clearWorkingCopy,
  isRecoverable,
  getAutosaveSessionId,
  rotateAutosaveSession,
  subscribeWorkingCopyWrites,
} from '@/lib/autosave';
import { workingCopyDocIdFor } from '@/lib/document-library';

interface UseAutosaveArgs {
  formData: FormData;
  paragraphs: ParagraphData[];
  vias: string[];
  references: string[];
  enclosures: string[];
  copyTos: string[];
  distList: string[];
  /** ENC: enclosure rows so recovery restores file bindings. */
  enclosureBindings?: { key: string; title: string; fileId?: string }[];
  /** Autosave writes only once this is true (after initial load). */
  ready: boolean;
}

const AUTOSAVE_DEBOUNCE_MS = 1500;

export function useAutosave({
  formData, paragraphs, vias, references, enclosures, copyTos, distList, enclosureBindings, ready,
}: UseAutosaveArgs) {
  // Copies on offer, newest first; the head is the one shown.
  const [candidates, setCandidates] = useState<WorkingCopy[]>([]);
  const recovery = candidates[0] ?? null;
  const suspended = useRef(false);
  const [sessionId, setSessionId] = useState<string>(() => getAutosaveSessionId());
  // The ref is the source of truth for the async paths; the state only
  // re-renders consumers when the id rotates.
  const sessionIdRef = useRef(sessionId);
  /** updatedAt of this tab's last successful write, per session. */
  const lastWrittenAt = useRef<number | null>(null);

  const rotate = useCallback(() => {
    const next = rotateAutosaveSession();
    sessionIdRef.current = next;
    lastWrittenAt.current = null;
    setSessionId(next);
    return next;
  }, []);

  // One-time recovery check on mount: every recoverable copy, any session.
  useEffect(() => {
    let cancelled = false;
    listWorkingCopies().then((copies) => {
      if (!cancelled) setCandidates(copies.filter((c) => isRecoverable(c)));
    });
    return () => { cancelled = true; };
  }, []);

  // Another tab wrote a newer copy under OUR session id: that tab owns
  // the slot now. Move to a fresh id rather than fight over it.
  useEffect(() => {
    return subscribeWorkingCopyWrites((msg) => {
      if (msg.sessionId !== sessionIdRef.current) return;
      if (lastWrittenAt.current !== null && msg.updatedAt <= lastWrittenAt.current) return;
      rotate();
    });
  }, [rotate]);

  // Debounced autosave. Skips while a recovery prompt is open (so the
  // blank form behind the dialog does not clobber the copy) and until
  // the caller marks the initial load complete.
  useEffect(() => {
    if (!ready || suspended.current || recovery) return;
    const timer = setTimeout(() => {
      const copy = { formData, paragraphs, vias, references, enclosures, copyTos, distList, enclosureBindings };
      void (async () => {
        const target = sessionIdRef.current;
        const result = await writeWorkingCopy(copy, { sessionId: target, lastWrittenAt: lastWrittenAt.current });
        if (result.ok) {
          if (sessionIdRef.current === target) lastWrittenAt.current = result.updatedAt;
          return;
        }
        if (result.reason === 'stale' && sessionIdRef.current === target) {
          // Refused: a newer copy exists under this id. Take a new id and
          // keep this tab's work under it.
          const fresh = rotate();
          const retry = await writeWorkingCopy(copy, { sessionId: fresh, lastWrittenAt: null });
          if (retry.ok && sessionIdRef.current === fresh) lastWrittenAt.current = retry.updatedAt;
        }
      })();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [ready, recovery, formData, paragraphs, vias, references, enclosures, copyTos, distList, enclosureBindings, rotate]);

  /**
   * Keeps the copy on offer where it is and moves to the next. When the
   * copy is this tab's own, the tab rotates its session id first so its
   * next autosave lands beside the kept copy, not over it.
   */
  const laterRecovery = useCallback(() => {
    if (recovery && recovery.sessionId === sessionIdRef.current) rotate();
    setCandidates((prev) => prev.slice(1));
  }, [recovery, rotate]);

  /**
   * Deletes the copy on offer and moves to the next. Returns the file
   * owner id of the discarded copy so the caller can sweep its files.
   */
  const discardRecovery = useCallback((): string | null => {
    if (!recovery) return null;
    void clearWorkingCopy(recovery.sessionId);
    if (recovery.sessionId === sessionIdRef.current) lastWrittenAt.current = null;
    setCandidates((prev) => prev.slice(1));
    return workingCopyDocIdFor(recovery.sessionId);
  }, [recovery]);

  /**
   * Called once the caller has loaded the copy on offer into the editor.
   * The other candidates stay on disk (they belong to other sessions)
   * and the prompt closes. A copy from another session is dropped from
   * the store, since its content now lives in this tab's copy.
   */
  const acceptRecovery = useCallback(() => {
    if (recovery && recovery.sessionId !== sessionIdRef.current) {
      void clearWorkingCopy(recovery.sessionId);
    }
    lastWrittenAt.current = null;
    setCandidates([]);
  }, [recovery]);

  /** Clears this tab's persisted copy (explicit save / clear form). */
  const clear = useCallback(() => {
    lastWrittenAt.current = null;
    void clearWorkingCopy(sessionIdRef.current);
  }, []);

  /** Temporarily halt autosave (e.g. during a bulk import). */
  const suspend = () => { suspended.current = true; };
  const resume = () => { suspended.current = false; };

  return {
    recovery,
    /** Copies waiting behind the one on offer. */
    recoveryRemaining: Math.max(0, candidates.length - 1),
    /** This tab's autosave session id (rotates when a newer copy claims it). */
    sessionId,
    /** The write-through file owner id for this tab's working copy. */
    workingCopyDocId: workingCopyDocIdFor(sessionId),
    laterRecovery,
    discardRecovery,
    acceptRecovery,
    clear,
    suspend,
    resume,
  };
}
