import { useEffect } from "react";
import "./DailyReport.css";

/* One entry per day, newest first. The top entry is the front page;
   the rest run as shorter columns beneath it. */
const REPORTS = [
  {
    date: "2026-10-10",
    headline: "Shipped the thing I said I'd ship",
    standfirst: "A short note on what moved today, and what didn't.",
    body: [
      "Spent the morning on the part of the product nobody sees and the afternoon on the part everybody does. The second half went faster because the first half was done properly.",
      "Tomorrow: close the loop with the team and write down what I learned before I forget it.",
    ],
  },
  {
    date: "2026-10-09",
    headline: "Two meetings, one decision",
    body: [
      "The decision was smaller than the meetings. That is usually the sign that it was the right one.",
    ],
  },
  {
    date: "2026-10-08",
    headline: "Rewrote the brief",
    body: [
      "Third draft. Shorter again. Every version loses a paragraph and gains a reader.",
    ],
  },
];

const formatDate = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default function DailyReport({ onClose, closing, style }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const [lead, ...rest] = REPORTS;

  return (
    <div
      className={`report-view ${closing ? "is-closing" : ""}`}
      style={style}
    >
      <button type="button" className="report-back" onClick={onClose}>
        <span aria-hidden="true">&larr;</span> Back
      </button>

      <div className="report-scroll">
        <article className="paper">
          <header className="paper__masthead">
            <p className="paper__ears">
              <span>Vol. 1</span>
              <span>{formatDate(lead.date)}</span>
              <span>Free of charge</span>
            </p>
            <h2 className="paper__title">The Daily Report</h2>
            <p className="paper__tagline">Delivering insights, one day at a time</p>
          </header>

          <section className="paper__lead">
            <h3 className="paper__headline">{lead.headline}</h3>
            {lead.standfirst && (
              <p className="paper__standfirst">{lead.standfirst}</p>
            )}
            <div className="paper__columns">
              {lead.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>

          {rest.length > 0 && (
            <section className="paper__briefs">
              {rest.map((entry) => (
                <article key={entry.date} className="brief">
                  <p className="brief__date">{formatDate(entry.date)}</p>
                  <h4 className="brief__headline">{entry.headline}</h4>
                  {entry.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </article>
              ))}
            </section>
          )}
        </article>
      </div>
    </div>
  );
}
