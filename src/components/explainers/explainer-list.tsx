"use client";

import { useState } from "react";
import { ExplainerCards } from "@/components/explainers/explainer-cards";
import { EXPLAINER_FILTERS, type ExplainerCard } from "@/lib/explainer-types";

/** The /explainers index, with the same filter buttons as /reports. */
export function ExplainerList({ explainers }: { explainers: ExplainerCard[] }) {
  const [filter, setFilter] = useState<string>("all");
  const shown = filter === "all" ? explainers : explainers.filter((e) => e.template === filter);

  return (
    <>
      <div className="filters" role="group" aria-label="Filter explainers by type">
        {EXPLAINER_FILTERS.map((option) => (
          <button
            key={option.key}
            type="button"
            className="filter"
            aria-pressed={filter === option.key}
            onClick={() => setFilter(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <p className="admin-help" aria-live="polite">
        {shown.length} of {explainers.length} explainers shown.
      </p>

      {shown.length === 0 ? (
        <p className="sub">
          {explainers.length === 0
            ? "No explainers are published yet. The first ones will appear here."
            : "No explainers of this type yet."}
        </p>
      ) : (
        <ExplainerCards explainers={shown} />
      )}
    </>
  );
}
