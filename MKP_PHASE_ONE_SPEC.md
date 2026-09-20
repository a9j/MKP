# MKP Phase One Build Spec

For: Claude Code, working in the existing Toledo Teacher Pay Explorer repo
Stack: Next.js (pnpm), Vercel, Supabase project `MKP` (ref `ypdmayocalrybwdurmgs`, region ca-central-1)
Date: 2026-09-20

---

## 1. What Phase One is

One sentence: a human-reviewed explainer system with claim-level sources, added to the app that already runs the Explorer.

In scope:

1. Source capture: upload a file, paste a URL, or paste text. The original is stored once and never overwritten.
2. AI draft: the AI reads the source and drafts claims. The draft is never public.
3. Claim review: a human labels, cites, and verifies every claim.
4. Publish: the database refuses to publish until the MKP Standard passes. Publishing freezes a version.
5. Public explainer page with a receipt drawer on every claim.
6. Coverage rules and an inbox, so "what do we explain" is a rule, not a mood.
7. Vote Watch for the TPS Board only. After the meeting, the explainer links to the vote.
8. One flagship report (Toledo Teacher Pay Report) whose headline numbers are claims with citations.

Out of scope (do not build, do not stub): Watchtower monitoring, City Council and County coverage, ballot pages, Public Money Explorer, Ask MKP, public search UI, SMS or push alerts, role tiers beyond admin.

---

## 2. What already exists. Do not rebuild it.

Read the repo first and follow its conventions for routing, Supabase clients, server actions, and styling.

Already in the database (migrations 0001 to 0007):

| Area | Tables |
|---|---|
| Admin and settings | `admins`, `site_settings` |
| Explorer data | `salary_schedule` (480 rows), `cpi`, `budget_categories`, `vacancies`, `vacancy_snapshots` |
| Records Desk | `agencies`, `records_requests`, `documents` |
| Vote Watch | `bodies` (`tps-board`, `toledo-city-council`, `lucas-county-commissioners`), `people`, `meetings`, `votes`, `vote_members` |
| Reports | `reports`, `report_sources` |
| Other | `listening_sessions`, `listening_points`, `corrections`, `inquiries`, `subscribers`, `jobs`, `ai_runs` |

Already in place and reused by this spec:

- `is_admin()` checks the signed in email against `admins`.
- `forbid_automation_publish()` stops the service role from publishing anything.
- `set_updated_at()` trigger function.
- `publish_status` enum: `draft`, `published`.
- Every table has RLS with an `admin all` policy. Public tables add a `public read` policy.
- Storage bucket `documents` (public).

---

## 3. The one rule that shapes everything

Three layers. They never mix.

| Layer | Table | Who writes | Who reads |
|---|---|---|---|
| 1. The original | `documents`, `document_pages` | Admin upload or automation | Public, if publishable |
| 2. What the AI extracted | `ai_runs`, plus unverified rows in `claims` | Automation (service role) | Admin only |
| 3. What a human approved | `explainer_versions` | Only `publish_explainer()` | Public |

The public site renders explainers from `explainers_public` (a view over the frozen snapshot). It never reads `explainers`, `claims`, or `citations` prose directly. So edits in progress can never leak.

---

## 4. Database changes

Files in `supabase/migrations/`:

1. `0008a_document_owner_type_source.sql` (run first, on its own)
2. `0008_editorial_system.sql`

Both were dry-run against the live MKP project (all 11 behavior checks passed), then applied on 2026-09-20. The recommended coverage rules for the TPS Board were seeded the same day.

New objects:

| Object | Purpose |
|---|---|
| `documents` (new columns) | `sha256`, `source_url`, `retrieved_at`, `source_kind`, `capture_method`, `is_publishable`, `withheld_reason`, `supersedes_id`, and more. A trigger makes a hashed document immutable. |
| `document_pages` | Page-by-page text for citations and search. |
| `explainers` | The working draft. Routing columns only are visible to anon. |
| `claims` | One checkable statement. Label is `fact`, `estimate`, `argument`, or `unknown`. Owner is an explainer, a report, or a vote. |
| `citations` | Claim to document, with page, locator, and exact quote. |
| `explainer_versions` | Frozen snapshot per publish. Cannot be edited. Version 2 and later needs a change note. |
| `explainers_public` (view) | What public pages query. |
| `coverage_rules` | Public, objective tests for what gets explained. |
| `intake_items` | The admin inbox. Cover needs a rule. Skip needs a reason. |
| `editorial_events` | Append-only audit trail written by triggers. |
| `explainer_problems(id)` | Returns the list of reasons an explainer cannot publish yet. |
| `publish_explainer(id, change_note)` | The only way to publish. |
| `match_coverage_rule(body, amount, type)` | Suggests a rule. A human still decides. |
| Bucket `documents-private` | Files that cannot legally be published. |

Rules the database enforces (the app should show these, not re-implement them):

- A `fact` or `estimate` with no citation blocks publishing.
- An `argument` must name who is making it (`attributed_to`).
- Claims in `supporters_say` and `opponents_say` must be labeled `argument`.
- Every claim must be verified by a signed in admin. Editing a claim or its citations un-verifies it.
- Automation can write claims. It can never verify, decide coverage, or publish.
- `exists_today` and `what_changes` each need at least one claim.
- `reading_grade` must be at or under `site_settings.explainer_max_reading_grade` (starts at 9).
- Setting `status = 'published'` directly fails. Only `publish_explainer()` works, called as the signed in admin.

---

## 5. Build steps

Do these in order. Finish and test each one before starting the next.

### Step 1. Apply migrations and regenerate types

1. Apply `0008a`, then `0008`.
2. Regenerate Supabase TypeScript types.
3. Run the Supabase security advisor. Fix anything new it reports.

Done when: types compile, advisor shows no new errors.

### Step 2. Source capture (`/admin/sources`)

1. Three inputs: Upload file, Add URL, Paste text.
2. Server side, for every capture:
   - Compute SHA-256 of the bytes with Node `crypto`.
   - If a document with that hash exists, open it. Do not store it twice.
   - Store at `sources/{yyyy}/{sha256}.{ext}` in bucket `documents`, or `documents-private` when "Cannot be published" is checked (then `withheld_reason` is required).
   - Pasted text is saved as a `.txt` file so it has a hash too.
   - Add URL: fetch the file server side, record `source_url` and `retrieved_at`.
   - Insert the `documents` row with `owner_type = 'source'` unless it belongs to a records request or meeting.
3. Extract text per page into `document_pages` (use `unpdf` or `pdfjs-dist`). If a PDF has no text layer, show "No text layer. Quotes must be typed by hand." No OCR in Phase One.
4. A newer version of a document is a new row with `supersedes_id` set.

Done when: the same file uploaded twice yields one row, and editing `sha256` in the SQL editor fails.

### Step 3. Inbox and coverage (`/admin/inbox`)

1. Table of `intake_items`: title, body, decision date, stated amount, item type, coverage.
2. "New item" form. `stated_amount` is the number printed in the source, never an estimate.
3. On save, call `match_coverage_rule`. Show "Matches rule: {name}" or "No rule matches."
4. Buttons: Cover (needs a rule), Skip (needs a reason). Cover creates the explainer and links it.
5. `/admin/coverage-rules`: simple CRUD.
6. Filters: This week, Pending, Covered, Skipped.

Done when: an item cannot be covered without a rule, and cannot be skipped without a reason.

### Step 4. AI draft

1. Create `lib/ai/` with one interface so the model provider can be swapped:

```ts
export interface ExplainerDraftInput {
  explainerId: string;
  documents: { id: string; title: string; pages: { page: number; text: string }[] }[];
}
export interface DraftClaim {
  section: 'exists_today' | 'what_changes' | 'who_affected' | 'cost'
         | 'supporters_say' | 'opponents_say' | 'uncertain' | 'what_next';
  label: 'fact' | 'estimate' | 'argument' | 'unknown';
  text: string;                 // one idea, short sentences, grade 8
  attributed_to: string | null; // required when label is 'argument'
  citations: { document_id: string; page: number; locator: string | null; quote: string }[];
}
export interface ExplainerDraft {
  one_sentence: string;   // 280 characters max
  summary_30s: string;    // 900 characters max
  identifier: string | null;
  decision_date: string | null; // YYYY-MM-DD, only if printed in the source
  process_steps: string[];
  current_step: number | null;
  claims: DraftClaim[];
}
export interface AiProvider { draftExplainer(input: ExplainerDraftInput): Promise<ExplainerDraft>; }
```

2. Prompt rules (store the prompt in the repo with a `prompt_version` string):
   - Use only the supplied pages. No outside knowledge.
   - Every `fact` and `estimate` needs a quote copied exactly from a page.
   - A projection, forecast, or fiscal estimate is `estimate`, never `fact`.
   - A claim about what will happen that the document does not state is an `argument` with a named source, or it is left out.
   - If the source does not say something a reader would ask, write an `unknown` claim.
   - Only list affected groups the document names.
   - No adjectives that judge. No "winning" or "losing."
   - Return JSON only.
3. After the model returns, the server (service role):
   - Writes one `ai_runs` row: `kind = 'explainer_draft'`, `model`, `prompt_version`, `input_hash`, `raw_response`.
   - Checks each quote appears in `document_pages.text` for that page (collapse whitespace before comparing). If not found, keep the claim but drop the citation and flag it.
   - Inserts claims with `ai_generated = true` and `ai_run_id`. Never sets `verified_at`.
   - Sets `explainers.ai_draft = true`, `stage = 'ai_draft'`.

Done when: a draft appears in review with zero verified claims, and the public site shows nothing.

### Step 5. Review screen (`/admin/explainers/[id]`)

1. Left: claims grouped by section, drag to reorder. Right: source viewer that jumps to the cited page and highlights the quote.
2. Per claim: label picker (four labels), text, attributed_to, citations, Verify button. Show a green check when the quote is found in the page text, a warning when it is not.
3. Top bar: live checklist from `explainer_problems(id)`. Publish stays disabled until the list is empty.
4. Compute `reading_grade` on every save with Flesch-Kincaid over one_sentence, summary_30s, and all claim text:
   `0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59`
5. Publish calls `publish_explainer(id, change_note)` through the signed in admin's Supabase client. Never the service role key. Version 2 and later shows a required "What changed?" box.
6. "History" tab reads `editorial_events` for this explainer and its claims.

Done when: every rule in section 4 can be seen failing, then passing, in the UI.

### Step 6. Public explainer (`/explainers/[slug]`)

Query `explainers_public` by slug. Render in this fixed order:

1. Title, identifier, body name
2. Upcoming Vote block (date and `decision_label`). Make it impossible to miss. Hide once `vote_id` is set, and show the result instead.
3. The 30-second version
4. What exists today
5. What would change
6. Who could be affected
7. What it costs
8. Supporters say / Opponents say (only if claims exist. Never invent a side.)
9. What remains uncertain
10. What happens next (step tracker from `process_steps` and `current_step`)
11. Show me the receipt: every document cited, with retrieved date and a link. Withheld documents show the title and the reason.
12. Version line: "Updated {date}. {change_note}" with links to older versions at `/explainers/[slug]/v/[version]`.

Every claim shows its label chip. Tapping a claim opens a drawer: exact quote, document title, page, locator, retrieved date, "Open original."

Also: `/explainers` index sorted by `decision_date`, and an "Our Method" section listing active `coverage_rules` and the four labels.

Done when: editing a published explainer's draft changes nothing on the public page until it is published again.

### Step 7. Vote Watch handoff (TPS Board only)

1. After the meeting, the admin records the vote in the existing votes admin.
2. On the explainer, "Link vote" sets `explainers.vote_id`, then republish with note "Vote recorded."
3. The vote page links back to the explainer.

### Step 8. Report claims

1. On the report admin page, add a Claims panel (same component as Step 5, `report_id` owner, no sections).
2. Each headline number in the Toledo Teacher Pay Report is a claim with a citation. Numbers from `salary_schedule` may cite by `source_url`.
3. App-level gate: the report Publish button stays disabled while any report claim is unverified, or any `fact` or `estimate` has no citation.

---

## 6. Design tokens

Calm, minimal, not political. No red versus blue. No green for "good."

| Token | Hex |
|---|---|
| Background | `#FFFFFF` |
| Surface | `#F5F5F7` |
| Ink | `#1D1D1F` |
| Secondary text | `#6E6E73` |
| Hairline | `#D2D2D7` |
| Accent (links, focus) | `#0F5C5C` |

Label chips (text on background):

| Label | Text | Background | Extra |
|---|---|---|---|
| FACT | `#1D1D1F` | `#E8E8ED` | solid |
| ESTIMATE | `#7A4F00` | `#FFF1CC` | solid |
| ARGUMENT | `#4B2E9E` | `#EFEAFB` | always followed by who said it |
| UNKNOWN | `#6E6E73` | `#FFFFFF` | 1px dashed `#D2D2D7` border |

Type: system font stack (`-apple-system, BLinkMacSystemFont, "SF Pro Text", "Inter", sans-serif`). Body 17px, line height 1.55, max line width 680px. Chips 12px, 600 weight, uppercase, 0.04em tracking, 6px radius. Cards 12px radius, no shadows, hairline borders. All chip pairs above pass WCAG AA.

---

## 7. Environment variables

| Name | Used for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Already set |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Source capture and AI draft inserts. Never for publishing. |
| `AI_PROVIDER` | For example `anthropic` |
| `AI_MODEL` | Model name string, saved on every `ai_runs` row |
| `AI_API_KEY` | Server only |

---

## 8. Final acceptance test

Run this by hand with one real TPS Board agenda item:

1. Upload the agenda PDF. Upload it again. One row.
2. Add the item to the inbox. Try Cover with no matching rule. Blocked.
3. Add the rule. Cover. Generate the AI draft.
4. Open the public URL. 404.
5. Try Publish. See the checklist of problems.
6. Verify claims one by one. Change a verified claim. It un-verifies.
7. Publish. Public page shows version 1 with a receipt on every fact.
8. Edit a claim. Public page does not change.
9. Republish with no note. Blocked. Add the note. Version 2 is live, version 1 still readable.
10. History tab shows who did each step.

---

## 9. Kickoff prompt for Claude Code

```text
Read MKP_PHASE_ONE_SPEC.md and the two files in supabase/migrations/ that start with 0008.
Then read this repo's routing, Supabase client setup, admin auth, and styling so you match what exists.
Do not rebuild anything listed in section 2 of the spec.
Work through section 5 one step at a time. After each step, stop, show me what changed, and tell me how to test it.
Never call publish_explainer with the service role key. Never write to explainer_versions directly.
Start with Step 1 and wait for me to confirm the migrations are applied.
```
