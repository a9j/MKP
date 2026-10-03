"use client";

import { useState } from "react";
import { CATEGORY_FILTERS, CHOICE_LABEL, type Vote } from "@/lib/queries/votes";
import { BODY_FILTERS } from "@/lib/bodies";
import { usd } from "@/lib/format";

/** Filter bar plus the vote log, with a per member breakdown on each entry. */
export function VoteList({ votes }: { votes: Vote[] }) {
  // Which body first, then which kind of decision. A reader who came for the
  // school board should not have to read past the council to find it.
  const [body, setBody] = useState<string>("all");
  const [filter, setFilter] = useState<string>("all");
  const shown = votes.filter(
    (v) =>
      (body === "all" || v.bodySlug === body) && (filter === "all" || v.category === filter),
  );

  return (
    <>
      {/* Two rows of pills with nothing between them read as one long bar, so
          each control says what it filters. */}
      <p className="filter-label" id="filter-body-label">
        Body
      </p>
      <div className="filters" role="group" aria-labelledby="filter-body-label">
        {BODY_FILTERS.map((option) => (
          <button
            key={option.key}
            type="button"
            className="filter"
            aria-pressed={body === option.key}
            onClick={() => setBody(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <p className="filter-label" id="filter-category-label">
        What it touches
      </p>
      <div className="filters" role="group" aria-labelledby="filter-category-label">
        {CATEGORY_FILTERS.map((option) => (
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
        {shown.length} of {votes.length} votes shown.
      </p>

      {shown.length === 0 ? (
        <p className="sub">No votes recorded under these filters yet.</p>
      ) : (
        <div className="vote-log">
          {shown.map((vote) => (
            <article className="vote" key={vote.id}>
              <div className="vote-head">
                <span className="vote-date">{vote.meetingDateLabel}</span>
                <span className="vote-kind">
                  {vote.bodyLabel} &middot; {vote.categoryLabel}
                </span>
              </div>
              <h2 className="vote-heading">{vote.itemTitle}</h2>
              <p className="vote-summary">{vote.summary}</p>

              <dl className="vote-facts">
                <div>
                  <dt>Tally</dt>
                  <dd>{vote.tally}</dd>
                </div>
                {vote.amount !== null ? (
                  <div>
                    <dt>Amount</dt>
                    <dd>{usd(vote.amount)}</dd>
                  </div>
                ) : null}
              </dl>

              <details className="vote-members">
                <summary>How each member voted</summary>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Member</th>
                      <th scope="col">Vote</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vote.members.map((member) => (
                      <tr key={member.personId}>
                        <th scope="row">{member.name}</th>
                        <td>{CHOICE_LABEL[member.vote]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>

              <p className="vote-links">
                {vote.agendaUrl ? (
                  <a href={vote.agendaUrl} target="_blank" rel="noopener noreferrer">
                    Agenda
                  </a>
                ) : (
                  <span className="unavailable">No agenda link</span>
                )}
                {vote.minutesUrl ? (
                  <a href={vote.minutesUrl} target="_blank" rel="noopener noreferrer">
                    Minutes
                  </a>
                ) : (
                  <span className="unavailable">No minutes link</span>
                )}
              </p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
