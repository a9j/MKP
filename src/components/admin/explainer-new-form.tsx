"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Toast } from "@/components/admin/toast";
import { createExplainer } from "@/lib/actions/explainers";
import { TEMPLATES, TEMPLATE_LABEL } from "@/lib/explainer-types";

const HINT = {
  ballot: "One page per election, one card per issue.",
  levy: "One page per levy, with a home cost calculator.",
  contract: "One page per bargaining cycle, as a timeline.",
} as const;

/** Pick a type and a title, then the editor opens with the right fields. */
export function ExplainerNewForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createExplainer(form);
      setErrors(result.fieldErrors);
      if (result.ok && result.id) {
        router.push(`/admin/explainers/${result.id}`);
      } else {
        setMessage(result.message);
      }
    });
  }

  return (
    <>
      <form className="admin-form" onSubmit={onSubmit}>
        <fieldset className="field-wide rollcall">
          <legend>Type</legend>
          {TEMPLATES.map((template, i) => (
            <label className="check-row" key={template}>
              <input type="radio" name="template" value={template} defaultChecked={i === 0} />
              <span>
                {TEMPLATE_LABEL[template]}
                <span className="explainer-type-hint"> {HINT[template]}</span>
              </span>
            </label>
          ))}
          {errors.template ? <p className="field-error">{errors.template}</p> : null}
        </fieldset>

        <div className="field field-wide">
          <label htmlFor="new-explainer-title">Title</label>
          <input id="new-explainer-title" name="title" required placeholder="November 2026 ballot" />
          {errors.title ? <p className="field-error">{errors.title}</p> : null}
        </div>

        <div className="admin-actions">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Creating" : "Create and open"}
          </button>
        </div>
      </form>
      <Toast message={message} tone="error" onDismiss={() => setMessage(null)} />
    </>
  );
}
