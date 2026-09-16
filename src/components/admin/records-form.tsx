"use client";

import { useRef, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Toast, type ToastTone } from "@/components/admin/toast";
import { createRecordsRequest, addAgency, type RequestStatus } from "@/lib/actions/records";
import { MAX_DOCUMENT_BYTES } from "@/lib/limits";

type Agency = { id: string; name: string };

const STATUSES: { value: RequestStatus; label: string }[] = [
  { value: "filed", label: "Filed" },
  { value: "partial", label: "Partial" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "denied", label: "Denied" },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RecordsForm({ agencies }: { agencies: Agency[] }) {
  const [list, setList] = useState(agencies);
  const [agencyId, setAgencyId] = useState(agencies[0]?.id ?? "");
  const [status, setStatus] = useState<RequestStatus>("filed");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // Inline add agency, so logging a request is not blocked by a missing office.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newAgency, setNewAgency] = useState("");
  const [newOfficer, setNewOfficer] = useState("");
  const [adding, setAdding] = useState(false);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createRecordsRequest(form);
      setErrors(result.fieldErrors);
      setToast({ message: result.message, tone: result.ok ? "ok" : "error" });
      if (result.ok) {
        formRef.current?.reset();
        setStatus("filed");
      }
    });
  }

  async function onAddAgency() {
    setAdding(true);
    try {
      const result = await addAgency(newAgency, newOfficer);
      setToast({ message: result.message, tone: result.ok ? "ok" : "error" });
      if (result.ok) {
        // Optimistically shown so the new office can be picked immediately.
        const optimistic = { id: "", name: newAgency.trim() };
        setList((current) => [...current, optimistic].sort((a, b) => a.name.localeCompare(b.name)));
        setNewAgency("");
        setNewOfficer("");
        setDialogOpen(false);
      }
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <form className="admin-form" ref={formRef} onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="record-agency">Agency</label>
          <select
            id="record-agency"
            name="agencyId"
            value={agencyId}
            onChange={(e) => setAgencyId(e.target.value)}
          >
            {list.map((agency) => (
              <option key={agency.id || agency.name} value={agency.id}>
                {agency.name}
              </option>
            ))}
          </select>
          <button type="button" className="inline-add" onClick={() => setDialogOpen(true)}>
            Add an agency
          </button>
          {errors.agencyId ? <p className="field-error">{errors.agencyId}</p> : null}
        </div>

        <div className="field">
          <label htmlFor="record-filed">Date filed</label>
          <input id="record-filed" name="dateFiled" type="date" defaultValue={today()} required />
          {errors.dateFiled ? <p className="field-error">{errors.dateFiled}</p> : null}
        </div>

        <div className="field field-wide">
          <label htmlFor="record-text">What we asked for</label>
          <textarea id="record-text" name="requestText" rows={3} required />
          {errors.requestText ? <p className="field-error">{errors.requestText}</p> : null}
        </div>

        <div className="field">
          <label htmlFor="record-status">Status</label>
          <select
            id="record-status"
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as RequestStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="record-responded">Date responded</label>
          <input id="record-responded" name="dateResponded" type="date" />
          {errors.dateResponded ? <p className="field-error">{errors.dateResponded}</p> : null}
        </div>

        {/* Only asked for when it applies, and required once it does. */}
        {status === "denied" ? (
          <div className="field field-wide">
            <label htmlFor="record-denial">Reason the office gave for denying</label>
            <textarea id="record-denial" name="denialReason" rows={2} required />
            {errors.denialReason ? <p className="field-error">{errors.denialReason}</p> : null}
          </div>
        ) : null}

        <div className="field field-wide">
          <label htmlFor="record-docs">Documents, PDF only, up to 25MB each</label>
          <input
            id="record-docs"
            name="documents"
            type="file"
            accept="application/pdf,.pdf"
            multiple
            aria-describedby="record-docs-help"
          />
          <p id="record-docs-help" className="counter">
            Anything larger than {Math.round(MAX_DOCUMENT_BYTES / 1024 / 1024)}MB, or not a
            PDF, is refused before the request is saved.
          </p>
          {errors.documents ? <p className="field-error">{errors.documents}</p> : null}
        </div>

        <div className="admin-actions">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Saving" : "Publish request"}
          </button>
        </div>
      </form>

      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog" aria-describedby="add-agency-help">
            <Dialog.Title>Add an agency</Dialog.Title>
            <Dialog.Description id="add-agency-help" className="admin-help">
              Offices you file with. The address shows on the public Records Desk page.
            </Dialog.Description>

            <div className="field">
              <label htmlFor="agency-name">Name</label>
              <input
                id="agency-name"
                value={newAgency}
                onChange={(e) => setNewAgency(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="agency-officer">Records officer email</label>
              <input
                id="agency-officer"
                type="email"
                value={newOfficer}
                onChange={(e) => setNewOfficer(e.target.value)}
              />
            </div>

            <div className="admin-actions">
              <button type="button" className="btn" onClick={onAddAgency} disabled={adding}>
                {adding ? "Adding" : "Add agency"}
              </button>
              <Dialog.Close asChild>
                <button type="button" className="btn ghost">
                  Cancel
                </button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Toast
        message={toast?.message ?? null}
        tone={toast?.tone ?? "ok"}
        onDismiss={() => setToast(null)}
      />
    </>
  );
}
