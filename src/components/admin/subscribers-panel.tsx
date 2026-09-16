"use client";

import { useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Toast, type ToastTone } from "@/components/admin/toast";
import {
  sendPublishNotice,
  exportSubscribers,
  type PublishNotice,
} from "@/lib/actions/admin";

export function SubscribersPanel({ context }: { context: PublishNotice }) {
  const [itemId, setItemId] = useState(context.items[0]?.id ?? "");
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const [pending, startTransition] = useTransition();

  const chosen = context.items.find((i) => i.id === itemId);

  function onSend() {
    startTransition(async () => {
      const result = await sendPublishNotice(itemId);
      setToast({ message: result.message, tone: result.ok ? "ok" : "error" });
      setOpen(false);
    });
  }

  async function onExport() {
    const result = await exportSubscribers();
    if (!result.ok) {
      setToast({ message: result.message, tone: "error" });
      return;
    }
    const blob = new Blob([result.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setToast({ message: result.message, tone: "ok" });
  }

  return (
    <>
      <div className="field field-wide">
        <label htmlFor="notice-item">What to tell subscribers about</label>
        <select id="notice-item" value={itemId} onChange={(e) => setItemId(e.target.value)}>
          {context.items.length === 0 ? (
            <option value="">Nothing published yet</option>
          ) : (
            context.items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="admin-actions">
        <button
          type="button"
          className="btn"
          onClick={() => setOpen(true)}
          disabled={!chosen || context.confirmedCount === 0}
        >
          Send publish notice
        </button>
        <button type="button" className="btn ghost" onClick={onExport}>
          Export as CSV
        </button>
      </div>

      {context.confirmedCount === 0 ? (
        <p className="admin-help">
          Nobody has confirmed their email yet, so there is nobody to write to.
        </p>
      ) : null}

      {/* The count is stated before anything is sent, because this is the one
          action here that cannot be taken back. */}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog" aria-describedby="send-notice-help">
            <Dialog.Title>Send this to {context.confirmedCount} people?</Dialog.Title>
            <Dialog.Description id="send-notice-help" className="admin-help">
              This sends one email to every subscriber who has confirmed their address,
              about {chosen?.label}. It cannot be unsent.
            </Dialog.Description>

            <div className="admin-actions">
              <button type="button" className="btn" onClick={onSend} disabled={pending}>
                {pending ? "Sending" : `Send to ${context.confirmedCount}`}
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
