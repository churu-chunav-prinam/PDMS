import type { Phase, StepType } from './constants.js';

/**
 * The default poll-day steps (seed:steps). Times are "day offset from POLL_DATE" + HH:MM, IST.
 * After seeding, the DISTRICT_ADMIN edits steps in the step master; this file is only the start.
 */
export interface StepSeed {
  phase: Phase;
  nameHi: string;
  nameEn: string;
  type: StepType;
  marker?: 'POLL_START';
  numberLabelHi?: string;
  numberLabelEn?: string;
  opens?: readonly [dayOffset: number, time: string];
  due?: readonly [dayOffset: number, time: string];
}

const turnout = (hour: string, label: string, en: string): StepSeed => ({
  phase: 'POLL_DAY',
  nameHi: `मतदान ${label} बजे तक`,
  nameEn: `Turnout till ${en}`,
  type: 'TURNOUT',
  opens: [0, hour],
  due: [0, addMinutes(hour, 30)],
});

function addMinutes(time: string, minutes: number): string {
  const [h = 0, m = 0] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export const STEP_SEED: readonly StepSeed[] = [
  { phase: 'PRE_POLL', nameHi: 'EVM एवं मतदान सामग्री प्राप्त', nameEn: 'EVM and poll material received', type: 'DONE', due: [-1, '14:00'] },
  { phase: 'PRE_POLL', nameHi: 'मतदान केंद्र हेतु प्रस्थान', nameEn: 'Departed for polling station', type: 'DONE', due: [-1, '16:00'] },
  { phase: 'PRE_POLL', nameHi: 'मतदान केंद्र पर सुरक्षित पहुँचे', nameEn: 'Reached polling station safely', type: 'DONE', due: [-1, '20:00'] },
  { phase: 'PRE_POLL', nameHi: 'मतदान केंद्र की स्थापना पूर्ण', nameEn: 'Polling station set up', type: 'DONE', due: [-1, '22:00'] },
  {
    phase: 'POLL_DAY', nameHi: 'मॉक पोल पूर्ण', nameEn: 'Mock poll completed', type: 'NUMBER',
    numberLabelHi: 'उपस्थित अभिकर्ता', numberLabelEn: 'Polling agents present',
    opens: [0, '05:30'], due: [0, '07:15'],
  },
  { phase: 'POLL_DAY', nameHi: 'मतदान प्रारंभ', nameEn: 'Poll started', type: 'DONE', marker: 'POLL_START', opens: [0, '07:30'], due: [0, '07:45'] },
  turnout('09:00', '9', '9 AM'),
  turnout('11:00', '11', '11 AM'),
  turnout('13:00', '1', '1 PM'),
  turnout('15:00', '3', '3 PM'),
  turnout('17:00', '5', '5 PM'),
  {
    phase: 'POLL_DAY', nameHi: 'समापन पर कतार में मतदाता', nameEn: 'Voters in queue at close', type: 'NUMBER',
    numberLabelHi: 'कतार में मतदाता', numberLabelEn: 'Voters in queue',
    opens: [0, '17:00'], due: [0, '17:45'],
  },
  { phase: 'POLL_DAY', nameHi: 'अंतिम मतदान', nameEn: 'Final turnout', type: 'TURNOUT', opens: [0, '17:00'], due: [0, '20:00'] },
  { phase: 'POST_POLL', nameHi: 'मतदान समाप्त एवं EVM सील', nameEn: 'Poll closed and EVM sealed', type: 'DONE', opens: [0, '17:00'], due: [0, '20:30'] },
  { phase: 'POST_POLL', nameHi: 'मतदान दल का प्रस्थान', nameEn: 'Polling party departed', type: 'DONE', opens: [0, '17:00'], due: [0, '21:30'] },
  { phase: 'POST_POLL', nameHi: 'सामग्री स्ट्रॉन्ग रूम में जमा', nameEn: 'Material deposited in strong room', type: 'DONE', opens: [0, '17:00'], due: [1, '02:00'] },
];

/** "YYYY-MM-DD" + offset + "HH:MM" -> MySQL DATETIME text (IST wall clock). */
export function seedDateTime(pollDate: string, at: readonly [number, string]): string {
  const d = new Date(`${pollDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + at[0]);
  return `${d.toISOString().slice(0, 10)} ${at[1]}:00`;
}
