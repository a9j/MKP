"use client";

import { useRef, useState, useTransition } from "react";
import { Toast, type ToastTone } from "@/components/admin/toast";
import { saveReport, sendToCouncil } from "@/lib/actions/reports";
import { SUMMARY_MARKDOWN_MAX } from "@/lib/limits";
import { slugify } from "@/lib/slug";

export type EditableReport = {
  id: string;
  slug: string;
  title: string;
  type: string;
  report_date: string;
  summary: string | null;
  status: string;
  preview_token: string;
  sources: { label: string; url: string }[];
};

const TYPES = [
  { value: "pay_report", label: "Pay Report" },
  { value: "levy_explainer", label: "Levy Explainer" },
  { value: "contract_tracker", label: "Contract Tracker" },
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
          <select id="report-type" name="type" defaultValue={report?.type ?? "pay_report"}>
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
