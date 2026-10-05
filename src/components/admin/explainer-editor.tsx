"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Toast, type ToastTone } from "@/components/admin/toast";
import { saveExplainer, publishExplainer } from "@/lib/actions/explainers";
import { slugify } from "@/lib/slug";
import {
  CONTRACT_EVENT_LABEL,
  LEVY_KIND_LABEL,
  explainerPath,
  type Template,
} from "@/lib/explainer-types";
import type {
  EventPayload,
  ExplainerPayload,
  IssuePayload,
  LevyPayload,
  SourcePayload,
} from "@/lib/explainer-payload";
import type { AdminExplainer } from "@/lib/queries/admin-explainers";

const SUMMARY_MAX = 900;
const ONE_LINE_MAX = 280;
const STATUS_MAX = 140;

function str(value: number | string | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function initialPayload(data: AdminExplainer): ExplainerPayload {
  const e = data.explainer;
  return {
    id: e.id,
    title: e.title,
    slug: e.slug,
    summary: e.summary_30s ?? "",
    oneSentence: e.one_sentence ?? "",
    decisionDate: e.decision_date ?? "",
    currentStatus: e.current_status ?? "",
    heroImagePath: e.hero_image_path,
    heroImageAlt: e.hero_image_alt ?? "",
    removeHeroImage: false,
    removePdf: false,
    sources: data.sources.map((s) => ({
      key: s.id,
      id: s.id,
      label: s.label,
      url: s.url,
      documentDate: s.document_date ?? "",
      note: s.note ?? "",
    })),
    issues: data.issues.map((i) => ({
      key: i.id,
      id: i.id,
      issueNumber: i.issue_number ?? "",
      title: i.title,
      jurisdiction: i.jurisdiction ?? "",
      whatYesMeans: i.what_yes_means,
      whatNoMeans: i.what_no_means,
      costNote: i.cost_note ?? "",
      costSourceKey: i.cost_source_id,
      linkedLevyId: i.linked_levy_explainer_id,
    })),
    levy:
      e.template === "levy"
        ? {
            districtOrBody: data.levy?.district_or_body ?? "",
            levyKind: data.levy?.levy_kind ?? "new",
            mills: str(data.levy?.mills),
            years: str(data.levy?.years),
            purpose: data.levy?.purpose ?? "",
            estimatedAnnualRevenue: str(data.levy?.estimated_annual_revenue),
            costPer100k: str(data.levy?.cost_per_100k),
            millsSourceKey: data.levy?.mills_source_id ?? null,
            revenueSourceKey: data.levy?.revenue_source_id ?? null,
            costSourceKey: data.levy?.cost_source_id ?? null,
          }
        : null,
    events: data.events.map((ev) => ({
      key: ev.id,
      id: ev.id,
      eventDate: ev.event_date,
      eventType: ev.event_type,
      headline: ev.headline,
      description: ev.description ?? "",
      sourceKey: ev.source_id,
    })),
  };
}

/** Errors come back keyed as "source.2.url"; this reads one out. */
function Err({ errors, name }: { errors: Record<string, string>; name: string }) {
  return errors[name] ? <p className="field-error">{errors[name]}</p> : null;
}

function SourceSelect({
  id,
  label,
  value,
  sources,
  onChange,
}: {
  id: string;
  label: string;
  value: string | null;
  sources: SourcePayload[];
  onChange: (key: string | null) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">No source picked</option>
        {sources.map((s, i) => (
          <option key={s.key} value={s.key}>
            {s.label.trim() || `Source ${i + 1} (unnamed)`}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * The whole explainer editor. After every save the page refreshes and the
 * fields are reloaded from the server, so rows created by a save come back
 * with their real ids and a second save updates them instead of adding them
 * again.
 */
export function ExplainerEditor({ data, problems }: { data: AdminExplainer; problems: string[] }) {
  const router = useRouter();
  const template = data.explainer.template as Template;
  const version = data.explainer.version;

  const [p, setP] = useState<ExplainerPayload>(() => initialPayload(data));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const [changeNote, setChangeNote] = useState("");
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const counter = useRef(0);
  const newKey = (prefix: string) => `new-${prefix}-${++counter.current}`;

  // A save bumps updated_at; reload from what the server now holds.
  const savedAt = data.explainer.updated_at;
  useEffect(() => {
    setP(initialPayload(data));
    formRef.current?.reset();
    setChangeNote("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedAt]);

  const set = <K extends keyof ExplainerPayload>(key: K, value: ExplainerPayload[K]) =>
    setP((cur) => ({ ...cur, [key]: value }));
  const setSource = (i: number, patch: Partial<SourcePayload>) =>
    set("sources", p.sources.map((s, j) => (i === j ? { ...s, ...patch } : s)));
  const setIssue = (i: number, patch: Partial<IssuePayload>) =>
    set("issues", p.issues.map((s, j) => (i === j ? { ...s, ...patch } : s)));
  const setEvent = (i: number, patch: Partial<EventPayload>) =>
    set("events", p.events.map((s, j) => (i === j ? { ...s, ...patch } : s)));
  const setLevy = (patch: Partial<LevyPayload>) =>
    set("levy", p.levy ? { ...p.levy, ...patch } : null);
  const moveIssue = (i: number, by: number) => {
    const next = [...p.issues];
    const [row] = next.splice(i, 1);
    next.splice(i + by, 0, row);
    set("issues", next);
  };

  const effectiveSlug = p.slug.trim() ? slugify(p.slug) : slugify(p.title);

  async function save(): Promise<boolean> {
    const form = new FormData(formRef.current ?? undefined);
    form.set("payload", JSON.stringify(p));
    const result = await saveExplainer(form);
    setErrors(result.fieldErrors);
    if (!result.ok) {
      setToast({ message: result.message, tone: "error" });
      return false;
    }
    return true;
  }

  function onSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      if (await save()) {
        setToast({ message: "Saved. Nothing changes on the public site until you publish.", tone: "ok" });
        router.refresh();
      }
    });
  }

  function onPublish() {
    startTransition(async () => {
      if (!(await save())) return;
      const result = await publishExplainer(p.id, changeNote);
      setErrors((cur) => ({ ...cur, ...result.fieldErrors }));
      setToast({ message: result.message, tone: result.ok ? "ok" : "error" });
      router.refresh();
    });
  }

  return (
    <>
      <form className="admin-form explainer-editor" ref={formRef} onSubmit={onSave} noValidate>
        {/* Basics */}
        <fieldset className="field-wide rollcall">
          <legend>The basics</legend>
          <div className="admin-form explainer-subform">
            <div className="field field-wide">
              <label htmlFor="ex-title">Title</label>
              <input id="ex-title" value={p.title} onChange={(e) => set("title", e.target.value)} />
              <Err errors={errors} name="title" />
            </div>

            <div className="field field-wide">
              <label htmlFor="ex-slug">Address</label>
              <input
                id="ex-slug"
                value={p.slug}
                placeholder={slugify(p.title)}
                onChange={(e) => set("slug", e.target.value)}
                aria-describedby="ex-slug-preview"
              />
              <p id="ex-slug-preview" className="counter">
                {explainerPath(template, effectiveSlug || "...")}
                {version > 0 ? ". Changing this after publishing breaks links people have shared." : null}
              </p>
              <Err errors={errors} name="slug" />
            </div>

            <div className="field field-wide">
              <label htmlFor="ex-summary">Summary, two or three plain sentences</label>
              <textarea
                id="ex-summary"
                rows={4}
                maxLength={SUMMARY_MAX}
                value={p.summary}
                onChange={(e) => set("summary", e.target.value)}
                aria-describedby="ex-summary-count"
              />
              <p id="ex-summary-count" className="counter" aria-live="polite">
                {SUMMARY_MAX - p.summary.length} characters left
              </p>
              <Err errors={errors} name="summary" />
            </div>

            <div className="field field-wide">
              <label htmlFor="ex-one">One line for cards and search results, optional</label>
              <input
                id="ex-one"
                maxLength={ONE_LINE_MAX}
                value={p.oneSentence}
                onChange={(e) => set("oneSentence", e.target.value)}
              />
              <p className="counter">Leave blank to use the summary.</p>
              <Err errors={errors} name="oneSentence" />
            </div>

            {template === "contract" ? (
              <div className="field field-wide">
                <label htmlFor="ex-status">Current status</label>
                <input
                  id="ex-status"
                  maxLength={STATUS_MAX}
                  placeholder="Talks ongoing"
                  value={p.currentStatus}
                  onChange={(e) => set("currentStatus", e.target.value)}
                />
                <p className="counter">Shown at the top with the date of the latest update.</p>
                <Err errors={errors} name="currentStatus" />
              </div>
            ) : (
              <div className="field">
                <label htmlFor="ex-date">Election date</label>
                <input
                  id="ex-date"
                  type="date"
                  value={p.decisionDate}
                  onChange={(e) => set("decisionDate", e.target.value)}
                />
                <Err errors={errors} name="decisionDate" />
              </div>
            )}
          </div>
        </fieldset>

        {/* Ballot issues */}
        {template === "ballot" ? (
          <fieldset className="field-wide rollcall">
            <legend>Issues, in ballot order</legend>
            {p.issues.length === 0 ? <p className="admin-help">No issues yet.</p> : null}
            {p.issues.map((issue, i) => (
              <div className="explainer-row" key={issue.key}>
                <div className="explainer-row-head">
                  <h4>Issue card {i + 1}</h4>
                  <div className="explainer-row-tools">
                    <button type="button" className="inline-add" disabled={i === 0} onClick={() => moveIssue(i, -1)}>
                      Move up
                    </button>
                    <button
                      type="button"
                      className="inline-add"
                      disabled={i === p.issues.length - 1}
                      onClick={() => moveIssue(i, 1)}
                    >
                      Move down
                    </button>
                    <button
                      type="button"
                      className="inline-add"
                      onClick={() => set("issues", p.issues.filter((_, j) => j !== i))}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="admin-form explainer-subform">
                  <div className="field">
                    <label htmlFor={`issue-${i}-number`}>Issue number</label>
                    <input
                      id={`issue-${i}-number`}
                      placeholder="Issue 3"
                      value={issue.issueNumber}
                      onChange={(e) => setIssue(i, { issueNumber: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`issue-${i}-where`}>Who it covers</label>
                    <input
                      id={`issue-${i}-where`}
                      placeholder="Toledo Public Schools"
                      value={issue.jurisdiction}
                      onChange={(e) => setIssue(i, { jurisdiction: e.target.value })}
                    />
                  </div>
                  <div className="field field-wide">
                    <label htmlFor={`issue-${i}-title`}>Title</label>
                    <input
                      id={`issue-${i}-title`}
                      value={issue.title}
                      onChange={(e) => setIssue(i, { title: e.target.value })}
                    />
                    <Err errors={errors} name={`issue.${i}.title`} />
                  </div>
                  <div className="field">
                    <label htmlFor={`issue-${i}-yes`}>What a yes vote does</label>
                    <textarea
                      id={`issue-${i}-yes`}
                      rows={3}
                      value={issue.whatYesMeans}
                      onChange={(e) => setIssue(i, { whatYesMeans: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`issue-${i}-no`}>What a no vote does</label>
                    <textarea
                      id={`issue-${i}-no`}
                      rows={3}
                      value={issue.whatNoMeans}
                      onChange={(e) => setIssue(i, { whatNoMeans: e.target.value })}
                    />
                  </div>
                  <div className="field field-wide">
                    <label htmlFor={`issue-${i}-cost`}>Cost note, optional</label>
                    <input
                      id={`issue-${i}-cost`}
                      placeholder="About $87 a year for each $100,000 of home value."
                      value={issue.costNote}
                      onChange={(e) => setIssue(i, { costNote: e.target.value })}
                    />
                  </div>
                  <SourceSelect
                    id={`issue-${i}-cost-source`}
                    label="Source for the cost"
                    value={issue.costSourceKey}
                    sources={p.sources}
                    onChange={(key) => setIssue(i, { costSourceKey: key })}
                  />
                  <div className="field">
                    <label htmlFor={`issue-${i}-levy`}>Link to a levy explainer, optional</label>
                    <select
                      id={`issue-${i}-levy`}
                      value={issue.linkedLevyId ?? ""}
                      onChange={(e) => setIssue(i, { linkedLevyId: e.target.value || null })}
                    >
                      <option value="">No levy page</option>
                      {data.levyOptions.map((levy) => (
                        <option key={levy.id} value={levy.id}>
                          {levy.title}
                          {levy.is_sample ? " (sample)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="inline-add"
              onClick={() =>
                set("issues", [
                  ...p.issues,
                  {
                    key: newKey("issue"),
                    id: null,
                    issueNumber: "",
                    title: "",
                    jurisdiction: "",
                    whatYesMeans: "",
                    whatNoMeans: "",
                    costNote: "",
                    costSourceKey: null,
                    linkedLevyId: null,
                  },
                ])
              }
            >
              Add an issue card
            </button>
          </fieldset>
        ) : null}

        {/* Levy figures */}
        {template === "levy" && p.levy ? (
          <fieldset className="field-wide rollcall">
            <legend>The levy</legend>
            <div className="admin-form explainer-subform">
              <div className="field field-wide">
                <label htmlFor="levy-body">District or body asking</label>
                <input
                  id="levy-body"
                  placeholder="Toledo Public Schools"
                  value={p.levy.districtOrBody}
                  onChange={(e) => setLevy({ districtOrBody: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="levy-kind">Kind of levy</label>
                <select
                  id="levy-kind"
                  value={p.levy.levyKind}
                  onChange={(e) => setLevy({ levyKind: e.target.value })}
                >
                  {Object.entries(LEVY_KIND_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <Err errors={errors} name="levy.levyKind" />
              </div>
              <div className="field">
                <label htmlFor="levy-years">Years, blank for continuing</label>
                <input
                  id="levy-years"
                  inputMode="numeric"
                  value={p.levy.years}
                  onChange={(e) => setLevy({ years: e.target.value })}
                />
                <Err errors={errors} name="levy.years" />
              </div>
              <div className="field">
                <label htmlFor="levy-mills">Mills</label>
                <input
                  id="levy-mills"
                  inputMode="decimal"
                  placeholder="2.5"
                  value={p.levy.mills}
                  onChange={(e) => setLevy({ mills: e.target.value })}
                />
                <Err errors={errors} name="levy.mills" />
              </div>
              <SourceSelect
                id="levy-mills-source"
                label="Source for the mills"
                value={p.levy.millsSourceKey}
                sources={p.sources}
                onChange={(key) => setLevy({ millsSourceKey: key })}
              />
              <div className="field">
                <label htmlFor="levy-revenue">Estimated revenue per year, optional</label>
                <input
                  id="levy-revenue"
                  inputMode="decimal"
                  placeholder="$12,000,000"
                  value={p.levy.estimatedAnnualRevenue}
                  onChange={(e) => setLevy({ estimatedAnnualRevenue: e.target.value })}
                />
                <Err errors={errors} name="levy.estimatedAnnualRevenue" />
              </div>
              <SourceSelect
                id="levy-revenue-source"
                label="Source for the revenue"
                value={p.levy.revenueSourceKey}
                sources={p.sources}
                onChange={(key) => setLevy({ revenueSourceKey: key })}
              />
              <div className="field">
                <label htmlFor="levy-cost">Auditor&rsquo;s yearly cost per $100,000, optional</label>
                <input
                  id="levy-cost"
                  inputMode="decimal"
                  placeholder="$87.50"
                  value={p.levy.costPer100k}
                  onChange={(e) => setLevy({ costPer100k: e.target.value })}
                />
                <p className="counter">
                  The calculator uses this when it is set, and the 35% formula when it is not.
                </p>
                <Err errors={errors} name="levy.costPer100k" />
              </div>
              <SourceSelect
                id="levy-cost-source"
                label="Source for the auditor's figure"
                value={p.levy.costSourceKey}
                sources={p.sources}
                onChange={(key) => setLevy({ costSourceKey: key })}
              />
              <div className="field field-wide">
                <label htmlFor="levy-purpose">What it pays for</label>
                <textarea
                  id="levy-purpose"
                  rows={3}
                  value={p.levy.purpose}
                  onChange={(e) => setLevy({ purpose: e.target.value })}
                />
              </div>
            </div>
          </fieldset>
        ) : null}

        {/* Contract timeline */}
        {template === "contract" ? (
          <fieldset className="field-wide rollcall">
            <legend>Timeline, newest first on the page</legend>
            {p.events.length === 0 ? (
              <p className="admin-help">No updates yet. Use Add an update above, or add one here.</p>
            ) : null}
            {p.events.map((ev, i) => (
              <div className="explainer-row" key={ev.key}>
                <div className="explainer-row-head">
                  <h4>{ev.headline.trim() || `Update ${i + 1}`}</h4>
                  <div className="explainer-row-tools">
                    <button
                      type="button"
                      className="inline-add"
                      onClick={() => set("events", p.events.filter((_, j) => j !== i))}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="admin-form explainer-subform">
                  <div className="field">
                    <label htmlFor={`event-${i}-date`}>Date</label>
                    <input
                      id={`event-${i}-date`}
                      type="date"
                      value={ev.eventDate}
                      onChange={(e) => setEvent(i, { eventDate: e.target.value })}
                    />
                    <Err errors={errors} name={`event.${i}.eventDate`} />
                  </div>
                  <div className="field">
                    <label htmlFor={`event-${i}-type`}>Type</label>
                    <select
                      id={`event-${i}-type`}
                      value={ev.eventType}
                      onChange={(e) => setEvent(i, { eventType: e.target.value })}
                    >
                      {Object.entries(CONTRACT_EVENT_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field field-wide">
                    <label htmlFor={`event-${i}-headline`}>Headline</label>
                    <input
                      id={`event-${i}-headline`}
                      maxLength={140}
                      value={ev.headline}
                      onChange={(e) => setEvent(i, { headline: e.target.value })}
                    />
                    <Err errors={errors} name={`event.${i}.headline`} />
                  </div>
                  <div className="field field-wide">
                    <label htmlFor={`event-${i}-desc`}>What happened, optional</label>
                    <textarea
                      id={`event-${i}-desc`}
                      rows={2}
                      value={ev.description}
                      onChange={(e) => setEvent(i, { description: e.target.value })}
                    />
                  </div>
                  <SourceSelect
                    id={`event-${i}-source`}
                    label="Source"
                    value={ev.sourceKey}
                    sources={p.sources}
                    onChange={(key) => setEvent(i, { sourceKey: key })}
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              className="inline-add"
              onClick={() =>
                set("events", [
                  {
                    key: newKey("event"),
                    id: null,
                    eventDate: new Date().toISOString().slice(0, 10),
                    eventType: "session",
                    headline: "",
                    description: "",
                    sourceKey: null,
                  },
                  ...p.events,
                ])
              }
            >
              Add an update here
            </button>
          </fieldset>
        ) : null}

        {/* Sources */}
        <fieldset className="field-wide rollcall">
          <legend>Sources. Every figure on the page must point at one.</legend>
          {p.sources.map((source, i) => (
            <div className="explainer-row" key={source.key}>
              <div className="admin-form explainer-subform">
                <div className="field">
                  <label htmlFor={`source-${i}-label`}>Label</label>
                  <input
                    id={`source-${i}-label`}
                    placeholder="Lucas County auditor certificate"
                    value={source.label}
                    onChange={(e) => setSource(i, { label: e.target.value })}
                  />
                  <Err errors={errors} name={`source.${i}.label`} />
                </div>
                <div className="field">
                  <label htmlFor={`source-${i}-url`}>Link</label>
                  <input
                    id={`source-${i}-url`}
                    type="url"
                    placeholder="https://"
                    value={source.url}
                    onChange={(e) => setSource(i, { url: e.target.value })}
                  />
                  <Err errors={errors} name={`source.${i}.url`} />
                </div>
                <div className="field">
                  <label htmlFor={`source-${i}-date`}>Document date</label>
                  <input
                    id={`source-${i}-date`}
                    type="date"
                    value={source.documentDate}
                    onChange={(e) => setSource(i, { documentDate: e.target.value })}
                  />
                  <Err errors={errors} name={`source.${i}.documentDate`} />
                </div>
                <div className="field">
                  <label htmlFor={`source-${i}-note`}>Note, optional</label>
                  <input
                    id={`source-${i}-note`}
                    placeholder="Page 4"
                    value={source.note}
                    onChange={(e) => setSource(i, { note: e.target.value })}
                  />
                </div>
              </div>
              <button
                type="button"
                className="inline-add"
                onClick={() => set("sources", p.sources.filter((_, j) => j !== i))}
                aria-label={`Remove source ${i + 1}`}
              >
                Remove this source
              </button>
            </div>
          ))}
          <button
            type="button"
            className="inline-add"
            onClick={() =>
              set("sources", [
                ...p.sources,
                { key: newKey("source"), id: null, label: "", url: "", documentDate: "", note: "" },
              ])
            }
          >
            Add a source
          </button>
        </fieldset>

        {/* Files */}
        <fieldset className="field-wide rollcall">
          <legend>Files, both optional</legend>
          <div className="admin-form explainer-subform">
            <div className="field field-wide">
              <label htmlFor="ex-pdf">PDF for download</label>
              <input id="ex-pdf" name="pdf" type="file" accept="application/pdf,.pdf" />
              <p className="counter">
                {data.explainer.pdf_path
                  ? `Attached: ${data.explainer.pdf_path.split("/").pop()}. A new file replaces it.`
                  : "No PDF attached."}
              </p>
              {data.explainer.pdf_path ? (
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={p.removePdf}
                    onChange={(e) => set("removePdf", e.target.checked)}
                  />
                  Remove the PDF
                </label>
              ) : null}
              <Err errors={errors} name="pdf" />
            </div>
            <div className="field field-wide">
              <label htmlFor="ex-hero">Photo at the top of the page</label>
              <input id="ex-hero" name="heroImage" type="file" accept="image/jpeg,image/png,image/webp" />
              <p className="counter">
                {data.explainer.hero_image_path
                  ? `Attached: ${data.explainer.hero_image_path.split("/").pop()}. A new file replaces it.`
                  : "JPEG, PNG or WebP, up to 5MB."}
              </p>
              {data.explainer.hero_image_path ? (
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={p.removeHeroImage}
                    onChange={(e) => set("removeHeroImage", e.target.checked)}
                  />
                  Remove the photo
                </label>
              ) : null}
              <Err errors={errors} name="heroImage" />
            </div>
            <div className="field field-wide">
              <label htmlFor="ex-hero-alt">What the photo shows, for screen readers</label>
              <input
                id="ex-hero-alt"
                value={p.heroImageAlt}
                onChange={(e) => set("heroImageAlt", e.target.value)}
              />
              <Err errors={errors} name="heroImageAlt" />
            </div>
          </div>
        </fieldset>

        {/* Save and publish */}
        <div className="field-wide explainer-publish">
          {version > 0 ? (
            <div className="field">
              <label htmlFor="ex-change-note">What changed, shown to readers</label>
              <input
                id="ex-change-note"
                value={changeNote}
                placeholder="Added the auditor's certified cost."
                onChange={(e) => setChangeNote(e.target.value)}
              />
              <p className="counter">Needed to publish again. Not needed for a draft save.</p>
              <Err errors={errors} name="changeNote" />
            </div>
          ) : null}
          <div className="admin-actions">
            <button className="btn ghost" type="submit" disabled={pending}>
              {pending ? "Working" : "Save draft"}
            </button>
            <button
              className="btn"
              type="button"
              onClick={onPublish}
              disabled={pending || data.explainer.is_sample}
              aria-describedby="ex-publish-hint"
            >
              {version > 0 ? "Save and publish update" : "Save and publish"}
            </button>
          </div>
          <p id="ex-publish-hint" className="counter">
            {data.explainer.is_sample
              ? "Samples cannot be published."
              : problems.length > 0
                ? "Publishing checks the list above first and stops if anything is left."
                : "Ready to publish. The page goes live as soon as you do."}
          </p>
        </div>
      </form>

      <Toast message={toast?.message ?? null} tone={toast?.tone ?? "ok"} onDismiss={() => setToast(null)} />
    </>
  );
}
