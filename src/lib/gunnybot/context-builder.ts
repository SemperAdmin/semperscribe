import type { GunnyTask } from './types';

/**
 * Assembles exactly the fields which leave the browser for a task. This
 * is the auditable egress surface: only documentType, subject, body, and
 * an optional question are ever included. A future form-field addition
 * does not widen what GunnyBot sends unless it passes through here.
 */

export interface GunnyContextInput {
  task: GunnyTask;
  documentType: string;
  subject: string;
  body: string;
  question?: string;
}

export interface GunnyContext {
  task: GunnyTask;
  text: string;
}

export function buildContext(input: GunnyContextInput): GunnyContext {
  const parts: string[] = [];
  parts.push('Document type: ' + input.documentType);
  if (input.subject.trim().length > 0) {
    parts.push('Subject: ' + input.subject.trim());
  }
  if (input.question && input.question.trim().length > 0) {
    parts.push('Question: ' + input.question.trim());
  }
  if (input.body.trim().length > 0) {
    parts.push('Draft:\n' + input.body.trim());
  }
  return { task: input.task, text: parts.join('\n\n') };
}
