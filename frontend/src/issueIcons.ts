import { BookUser, Cpu, HelpCircle, ShieldAlert, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { IssueType } from './api/types';

/** One icon per issue type, used on every issue screen. */
export const ISSUE_ICONS: Record<IssueType, LucideIcon> = {
  LAW_ORDER: ShieldAlert,
  EVM_FAULT: Cpu,
  POWER_WATER: Zap,
  VOTER_LIST: BookUser,
  OTHER: HelpCircle,
};
