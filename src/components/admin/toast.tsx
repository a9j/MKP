"use client";

import { useEffect, useState } from "react";

export type ToastTone = "ok" | "error";

/**
 * Reports exactly what happened after a save.
 *
 * aria-live so it is announced rather than only seen, and it stays until it is
 * replaced or dismissed: a message about what was written to a public site
 * should not vanish before it is read.
 */
export function Toast({
  message,
  tone,
  onDismiss,
}: {
  message: string | null;
  tone: ToastTone;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    setVisible(Boolean(message));
  }, [message]);

  if (!message || !visible) return null;

  return (
    <div className={`toast toast-${tone}`} role="status" aria-live="polite">
      <span>{message}</span>
      <button
        type="button"
        onClick={() => {
          setVisible(false);
          onDismiss();
        }}
        aria-label="Dismiss"
      >
        Dismiss
      </button>
    </div>
  );
}
