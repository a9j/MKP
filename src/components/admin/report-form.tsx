"use client";

import { useRef, useState, useTransition } from "react";
import { Toast, type ToastTone } from "@/components/admin/toast";
import { saveReport, sendToCouncil } from "@/lib/actions/reports";
import { isExplainer } from "@/lib/report-types";
import { SUMMARY_MARKDOWN_MAX } from "@/lib/limits";
import { slugify } from "@/lib/slug";

export type EditableReport = {
  id: string;
  slug: string;
  title: string;
  type: string;
  report_date: string;
  summary: string | null;
  body?: string | null;
  status: string;
  preview_token: string;
  sources: { label: string; url: string }[];
  ballot_date: string | null;
  issue_number: string | null;
  asks_for: string | null;
  funds: string | null;
  if_fails: string | null;
  homeowner_cost: string | null;
};

/** The three questions every explainer answers, and the one it may. */
const EXPLAINER_FIELDS = [
  {
    name: "asksFor",
    column: "asks_for",
    label: "What it asks for",
    help: "The levy, the rate, the term. What the ballot is actually asking the voter to approve.",
    required: true,
  },
  {
    name: "funds",
    column: "funds",
    label: "What it would fund",
    help: "Where the money goes if it passes, as the official documents describe it.",
    required: true,
  },
  {
    name: "ifFails",
    column: "if_fails",
    label: "What happens if it fails",
    help: "What the record says follows. Not a warning, and not a prediction of your own.",
    required: true,
  },
  {
    name: "homeownerCost",
    column: "homeowner_cost",
    label: "What it costs a homeowner",
    help: "Optional, and only from the county auditor's certification. Cite it in the text, with the figure it states.",
    required: false,
  },
] as const;

const TYPES = [
  { value: "pay_report", label: "Pay Report" },
  { value: "levy_explainer", label: "Levy Explainer" },
  { value: "contract_tracker", label: "Contract Tracker" },
  { value: "ballot_explainer", label: "Ballot Explainer" },
];

type SourceRow = { label: string; url: string };

export function ReportForm({
  report,
  siteUrl,
}: {
  report?: EditableReport;
  siteUrl: string;
}) {
  const [title, setTitle] = useState(report?.title ?? "");
  const [slug, setSlug] = useState(report?.slug ?? "");
  const [summary, setSummary] = useState(report?.summary ?? "");
  const [status, setStatus] = useState(report?.status ?? "draft");
  const [type, setType] = useState(report?.type ?? "pay_report");
  const [sources, setSources] = useState<SourceRow[]>(
    report?.sources.length ? report.sources : [{ label: "", url: "" }],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const [pending, startTransition] = useTransition();
  const [sending, setSending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // The address is derived from the title until it is typed over, so it is
  // visible before publishing rather than a surprise afterwards.
  const effectiveSlug = slug.length > 0 ? slugify(slug) : slugify(title);
  const remaining = SUMMARY_MARKDOWN_MAX - summary.length;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await saveReport(form);
      setErrors(result.fieldErrors);
      setToast({ message: result.message, tone: result.ok ? "ok" : "error" });
      if (result.ok && !report) {
        formRef.current?.reset();
        setTitle("");
        setSlug("");
        setSummary("");
        setSources([{ label: "", url: "" }]);
      }
    });
  }

  async function onSendToCouncil() {
    if (!report) return;
    setSending(true);
    try {
      const result = await sendToCouncil(report.id);
      setToast({ message: result.message, tone: result.ok ? "ok" : "error" });
    } finally {
      setSending(false);
    }
  }

  const previewUrl = report ? `${siteUrl}/reports/preview/${report.preview_token}` : null;

  return (
    <>
      <form className="admin-form" ref={formRef} onSubmit={onSubmit}>
        {report ? <input type="hidden" name="id" value={report.id} /> : null}

        <div className="field field-wide">
          <label htmlFor="report-title">Title</label>
          <input
            id="report-title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          {errors.title ? <p className="field-error">{errors.title}</p> : null}
        </div>

        <div className="field field-wide">
          <label htmlFor="report-slug">Address</label>
          <input
            id="report-slug"
            name="slug"
            value={slug}
            placeholder={slugify(title) || "made from the title"}
            onChange={(e) => setSlug(e.target.value)}
            aria-describedby="report-slug-preview"
          />
          <p id="report-slug-preview" className="counter">
            /reports/{effectiveSlug || "..."}
          </p>
          {errors.slug ? <p className="field-error">{errors.slug}</p> : null}
        </div>

        <div className="field">
          <label htmlFor="report-type">Type</label>
          <select
            id="report-type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="report-date">Report date</label>
          <input
            id="report-date"
            name="reportDate"
            type="date"
            defaultValue={report?.report_date ?? new Date().toISOString().slice(0, 10)}
            required
          />
          {errors.reportDate ? <p className="field-error">{errors.reportDate}</p> : null}
        </div>

        <div className="field field-wide">
          <label htmlFor="report-summary">Summary, markdown</label>
          <textarea
            id="report-summary"
            name="summary"
            rows={5}
            maxLength={SUMMARY_MARKDOWN_MAX}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            aria-describedby="report-summary-count"
            required
          />
          <p
            id="report-summary-count"
            className={remaining < 60 ? "counter counter-low" : "counter"}
            aria-live="polite"
          >
            {remaining} characters left of {SUMMARY_MARKDOWN_MAX}
          </p>
          {errors.summary ? <p className="field-error">{errors.summary}</p> : null}
        </div>

        {/* An explainer is a fixed shape, so the fields that shape it appear
            only for one, and the three it always answers are required here as
            well as on the server. */}
        {isExplainer(type) ? (
          <fieldset className="field-wide rollcall">
            <legend>On the ballot</legend>

            <div className="field">
              <label htmlFor="report-ballot-date">Election date</label>
              <input
                id="report-ballot-date"
                name="ballotDate"
                type="date"
                defaultValue={report?.ballot_date ?? ""}
              />
              <p className="counter">
                A date still to come is what puts this under &ldquo;On the ballot&rdquo; on
                the reports page. It comes off by itself the day after.
              </p>
              {errors.ballotDate ? <p className="field-error">{errors.ballotDate}</p> : null}
            </div>

            <div className="field">
              <label htmlFor="report-issue-number">Issue number</label>
              <input
                id="report-issue-number"
                name="issueNumber"
                placeholder="Issue 12"
                defaultValue={report?.issue_number ?? ""}
              />
              {errors.issueNumber ? <p className="field-error">{errors.issueNumber}</p> : null}
            </div>

            {EXPLAINER_FIELDS.map((field) => (
              <div className="field field-wide" key={field.name}>
                <label htmlFor={`report-${field.name}`}>
                  {field.label}
                  {field.required ? "" : ", optional"}
                </label>
                <textarea
                  id={`report-${field.name}`}
                  name={field.name}
                  rows={4}
                  defaultValue={report?.[field.column] ?? ""}
                />
                <p className="counter">{field.help}</p>
                {errors[field.name] ? <p className="field-error">{errors[field.name]}</p> : null}
              </div>
            ))}
          </fieldset>
        ) : null}

        <div className="field field-wide">
          <label htmlFor="report-body">Full explainer, markdown</label>
          <textarea
            id="report-body"
            name="body"
            rows={18}
            defaultValue={report?.body ?? ""}
            aria-describedby="report-body-help"
          />
          <p id="report-body-help" className="admin-help">
            The whole explainer, shown on the report page. Use ## for each issue heading.
            The PDF, if you attach one, is offered as a download alongside it.
          </p>
        </div>

        <fieldset className="field-wide rollcall">
          <legend>Sources, at least one</legend>
          {errors.sources ? <p className="field-error">{errors.sources}</p> : null}
          {sources.map((source, i) => (
            <div className="source-row" key={i}>
              <div className="field">
                <label htmlFor={`source-label-${i}`}>Label</label>
                <input
                  id={`source-label-${i}`}
                  name="sourceLabel"
                  value={source.label}
                  onChange={(e) =>
                    setSources((rows) =>
                      rows.map((r, j) => (i === j ? { ...r, label: e.target.value } : r)),
                    )
                  }
                />
                {errors[`sourceLabel${i}`] ? (
                  <p className="field-error">{errors[`sourceLabel${i}`]}</p>
                ) : null}
              </div>
              <div className="field">
                <label htmlFor={`source-url-${i}`}>Link</label>
                <input
                  id={`source-url-${i}`}
                  name="sourceUrl"
                  type="url"
                  placeholder="https://"
                  value={source.url}
                  onChange={(e) =>
                    setSources((rows) =>
                      rows.map((r, j) => (i === j ? { ...r, url: e.target.value } : r)),
                    )
                  }
                />
                {errors[`sourceUrl${i}`] ? (
                  <p className="field-error">{errors[`sourceUrl${i}`]}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="inline-add"
                onClick={() => setSources((rows) => rows.filter((_, j) => j !== i))}
                disabled={sources.length === 1}
                aria-label={`Remove source ${i + 1}`}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="inline-add"
            onClick={() => setSources((rows) => [...rows, { label: "", url: "" }])}
          >
            Add another source
          </button>
        </fieldset>

        <div className="field field-wide">
          <label htmlFor="report-pdf">PDF</label>
          <input id="report-pdf" name="pdf" type="file" accept="application/pdf,.pdf" />
          <p className="counter">
            Replaces the current PDF. Leave empty to keep the one already attached.
          </p>
          {errors.pdf ? <p className="field-error">{errors.pdf}</p> : null}
        </div>

        <div className="field">
          <label htmlFor="report-status">Status</label>
          <select
            id="report-status"
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>

        <div className="admin-actions">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Saving" : status === "published" ? "Publish report" : "Save draft"}
          </button>
        </div>
      </form>

      {report ? (
        <div className="preview-links">
          <h4>Advisory council review</h4>
          <p className="admin-help">
            This link opens the draft without a login, so a reviewer does not need an
            account. Treat it as unlisted rather than secret.
          </p>
          <p className="preview-url">
            <a href={previewUrl!} target="_blank" rel="noopener noreferrer">
              {previewUrl}
            </a>
          </p>
          <div className="admin-actions">
            <button type="button" className="btn ghost" onClick={onSendToCouncil} disabled={sending}>
              {sending ? "Sending" : "Send to council"}
            </button>
          </div>
        </div>
      ) : null}

      <Toast
        message={toast?.message ?? null}
        tone={toast?.tone ?? "ok"}
        onDismiss={() => setToast(null)}
      />
    </>
  );
}
