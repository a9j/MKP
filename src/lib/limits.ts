/**
 * Shared limits. Kept out of the "use server" modules, which may only export
 * async functions, so the forms and the actions can agree on one number.
 */

/** Matches the check constraint on votes.summary. */
export const SUMMARY_MAX = 200;

/** Report summaries are markdown, and short on purpose. */
export const SUMMARY_MARKDOWN_MAX = 600;

/** Per file, for records request documents. */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

/** Ohio's Public Records Act sets no fixed deadline, so this is our own mark. */
export const OVERDUE_BUSINESS_DAYS = 10;
