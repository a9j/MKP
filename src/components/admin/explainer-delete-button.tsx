"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteExplainer } from "@/lib/actions/explainers";

/** Only offered for an explainer that was never published. */
export function ExplainerDeleteButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="inline-add"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
        startTransition(async () => {
          const result = await deleteExplainer(id);
          if (!result.ok) window.alert(result.message);
          router.refresh();
        });
      }}
    >
      {pending ? "Deleting" : "Delete"}
    </button>
  );
}
