"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Toast, type ToastTone } from "@/components/admin/toast";
import { addContractUpdate } from "@/lib/actions/explainers";
import { CONTRACT_EVENT_LABEL } from "@/lib/explainer-types";

/**
 * The fast path for a contract tracker: date, type, headline, source, done.
 * A new document can be pasted in place, since a fresh update usually comes
 * with a fresh document.
 */
export function ContractQuickUpdate({
  explainerId,
  sources,
  canPublish,
}: {
  explainerId: string;
  sources: { id: string; label: string }[];
  canPublish: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [sourceChoice, setSourceChoice] = useState(sources[0]?.id ?? "new");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set("explainerId", explainerId);
    startTransition(async () => {
      const result = await addContractUpdate(form);
      setErrors(result.fieldErrors);
      setToast({ message: result.message, tone: result.ok ? "ok" : "error" });
      if (result.ok || result.message.startsWith("Update added")) {
        formRef.current?.reset();
        router.refresh();
      }
    });
  }

  return (
    <section className="uploader explainer-quick">
      <h3>Add an update</h3>
      <p className="admin-help">Adds one event to the top of the timeline.</p>
      <form className="admin-form" ref={formRef} onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="quick-date">Date</label>
          <input
            id="quick-date"
            name="eventDate"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
          />
          {errors.eventDate ? <p className="field-error">{errors.eventDate}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="quick-type">Type</label>
          <select id="quick-type" name="eventType" defaultValue="session">
            {Object.entries(CONTRACT_EVENT_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field field-wide">
          <label htmlFor="quick-headline">Headline</label>
          <input id="quick-headline" name="headline" maxLength={140} required placeholder="Both sides met for a fourth session" />
          {errors.headline ? <p className="field-error">{errors.headline}</p> : null}
        </div>
        <div className="field field-wide">
          <label htmlFor="quick-desc">What happened, optional</label>
          <textarea id="quick-desc" name="description" rows={2} />
        </div>
        <div className="field field-wide">
          <label htmlFor="quick-source">Source</label>
          <select
            id="quick-source"
            name="sourceId"
            value={sourceChoice}
            onChange={(e) => setSourceChoice(e.target.value)}
          >
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
            <option value="new">A new document</option>
            <option value="">No source yet</option>
          </select>
        </div>
        {sourceChoice === "new" ? (
          <>
            <div className="field">
              <label htmlFor="quick-new-label">Document name</label>
              <input id="quick-new-label" name="newSourceLabel" placeholder="Board meeting minutes" />
              {errors.newSourceLabel ? <p className="field-error">{errors.newSourceLabel}</p> : null}
            </div>
            <div className="field">
              <label htmlFor="quick-new-url">Link</label>
              <input id="quick-new-url" name="newSourceUrl" type="url" placeholder="https://" />
              {errors.newSourceUrl ? <p className="field-error">{errors.newSourceUrl}</p> : null}
            </div>
          </>
        ) : null}
        {canPublish ? (
          <label className="check-row field-wide">
            <input type="checkbox" name="publishNow" />
            Publish the page with this update
          </label>
        ) : null}
        <div className="admin-actions">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Adding" : "Add update"}
          </button>
        </div>
      </form>
      <Toast message={toast?.message ?? null} tone={toast?.tone ?? "ok"} onDismiss={() => setToast(null)} />
    </section>
  );
}
