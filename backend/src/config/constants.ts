// Domain constants shared by the API, scripts and tests. Change here, never inline.

export const ROLES = ['DISTRICT_ADMIN', 'SECTOR_OFFICER', 'POLLING_OFFICER'] as const;
export type Role = (typeof ROLES)[number];

export const PHASES = ['PRE_POLL', 'POLL_DAY', 'POST_POLL'] as const;
export type Phase = (typeof PHASES)[number];

export const STEP_TYPES = ['DONE', 'NUMBER', 'TURNOUT'] as const;
export type StepType = (typeof STEP_TYPES)[number];

export const ISSUE_TYPES = ['LAW_ORDER', 'EVM_FAULT', 'POWER_WATER', 'VOTER_LIST', 'OTHER'] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

/** Login lockout: after this many wrong passwords the account is locked for LOCK_MINUTES. */
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

export const BCRYPT_COST = 12;

/** Indian mobile number: 10 digits starting 6-9. */
export const MOBILE_REGEX = /^[6-9]\d{9}$/;
/** Booth label in Excel files and screens: PS code + "-" + booth number padded to 3 digits (RTG-045). */
export const BOOTH_NO_PAD = 3;
/** Officer passwords are chosen by the admin; bcrypt cost 10 keeps a 1,359-row bulk upload under a minute. */
export const OFFICER_BCRYPT_COST = 10;

/** Excel uploads (bulk officers): base64 in JSON, at most this many bytes of file. */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
