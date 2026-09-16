"use client";

import { useState } from "react";
import { CATEGORY_FILTERS, CHOICE_LABEL, type Vote } from "@/lib/queries/votes";
import { usd } from "@/lib/format";

/** Filter bar plus the vote log, with a per member breakdown on each entry. */
export function VoteList({ votes }: { votes: Vote[] }) {
  const [filter, setFilter] = useState<string>("all");
  const shown = filter === "all" ? votes : votes.filter((v) => v.category === filter);

  return (
    <>
      <div className="filters" role="group" aria-label="Filter votes by category">
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
        <p className="sub">No votes in this category yet.</p>
      ) : (
        <div className="vote-log">
          {shown.map((vote) => (
            <article className="vote" key={vote.id}>
              <div className="vote-head">
                <span className="vote-date">{vote.meetingDateLabel}</span>
                <span className="vote-kind">
                  {vote.bodyName} &middot; {vote.categoryLabel}
                </span>
              </div>
              <h3>{vote.itemTitle}</h3>
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
