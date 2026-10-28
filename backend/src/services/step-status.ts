import type { Step } from './steps.js';

export type StepStatus = 'done' | 'pending' | 'locked' | 'overdue';

/**
 * One rule for every screen. Reported = done. With step times enforced: locked before opens_at,
 * overdue after due_by. Without (the default): every other step is simply pending.
 */
export function stepStatus(step: Pick<Step, 'opensAt' | 'dueBy'>, reported: boolean, now: Date, enforceTimes: boolean): StepStatus {
  if (reported) return 'done';
  if (!enforceTimes) return 'pending';
  if (step.opensAt && now < step.opensAt) return 'locked';
  if (step.dueBy && now > step.dueBy) return 'overdue';
  return 'pending';
}
