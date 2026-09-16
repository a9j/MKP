"use client";

import { useRef, useState, useTransition } from "react";
import { Toast, type ToastTone } from "@/components/admin/toast";
import { savePerson } from "@/lib/actions/admin";

type Body = { id: string; name: string };

const ROLES = [
  { value: "staff", label: "Staff" },
  { value: "board", label: "Board" },
  { value: "advisory", label: "Advisory Council" },
  { value: "body_member", label: "Body Member" },
];

export function PersonForm({ bodies }: { bodies: Body[] }) {
  const [role, setRole] = useState("staff");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await savePerson(form);
      setErrors(result.fieldErrors);
      setToast({ message: result.message, tone: result.ok ? "ok" : "error" });
      if (result.ok) {
        formRef.current?.reset();
        setRole("staff");
      }
    });
  }

  return (
    <>
      <form className="admin-form" ref={formRef} onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="person-name">Name</label>
          <input id="person-name" name="name" required />
          {errors.name ? <p className="field-error">{errors.name}</p> : null}
        </div>

        <div className="field">
          <label htmlFor="person-title">Title</label>
          <input id="person-title" name="title" />
        </div>

        <div className="field">
          <label htmlFor="person-role">Role</label>
          <select
            id="person-role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* Only elected members sit on a body, so the field only appears then. */}
        {role === "body_member" ? (
          <div className="field">
            <label htmlFor="person-body">Body</label>
            <select id="person-body" name="bodyId" defaultValue={bodies[0]?.id}>
              {bodies.map((body) => (
                <option key={body.id} value={body.id}>
                  {body.name}
                </option>
              ))}
            </select>
            {errors.bodyId ? <p className="field-error">{errors.bodyId}</p> : null}
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="person-email">Email</label>
          <input id="person-email" name="email" type="email" />
          <p className="counter">
            Not published. Used to send advisory council members a report preview.
          </p>
          {errors.email ? <p className="field-error">{errors.email}</p> : null}
        </div>

        <div className="field">
          <label htmlFor="person-sort">Sort order</label>
          <input id="person-sort" name="sortOrder" inputMode="numeric" defaultValue="0" />
        </div>

        <div className="field">
          <label htmlFor="person-term-start">Term start</label>
          <input id="person-term-start" name="termStart" type="date" />
          {errors.termStart ? <p className="field-error">{errors.termStart}</p> : null}
        </div>

        <div className="field">
          <label htmlFor="person-term-end">Term end</label>
          <input id="person-term-end" name="termEnd" type="date" />
          {errors.termEnd ? <p className="field-error">{errors.termEnd}</p> : null}
        </div>

        <div className="field field-wide">
          <label htmlFor="person-bio">Bio</label>
          <textarea id="person-bio" name="bio" rows={3} />
        </div>

        <div className="field field-wide">
          <label htmlFor="person-photo">Photo</label>
          <input id="person-photo" name="photo" type="file" accept="image/*" />
          {errors.photo ? <p className="field-error">{errors.photo}</p> : null}
        </div>

        <div className="field field-wide checkbox-field">
          <input id="person-active" name="active" type="checkbox" defaultChecked />
          <label htmlFor="person-active">Active, show on the public site</label>
        </div>

        <div className="admin-actions">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Saving" : "Save person"}
          </button>
        </div>
      </form>

      <Toast
        message={toast?.message ?? null}
        tone={toast?.tone ?? "ok"}
        onDismiss={() => setToast(null)}
      />
    </>
  );
}
