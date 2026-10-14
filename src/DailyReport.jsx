import { useEffect, useState } from "react";
import { briefs, concepts } from "./data/tube-brief";
import "./DailyReport.css";

/* Ratings live in this browser only, keyed by item id. */
const RATINGS_KEY = "daily-report.ratings.v1";

const loadRatings = () => {
  try {
    return JSON.parse(localStorage.getItem(RATINGS_KEY)) || {};
  } catch {
    return {};
  }
};

const saveRatings = (ratings) => {
  try {
    localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings));
  } catch {
    /* Private mode: the rating just won't survive a reload. */
  }
};

const formatDate = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/* The automation writes one JSON file per day into src/data/tube-brief
   (newest first out of its index). The view shows the latest edition;
   the edition number is its place in the run, counted from the first. */
const EDITION = briefs[0] ?? null;
const EDITION_NO = briefs.length;

/* Items carry their own "~35 min (abstract and intro in 8)" strings;
   the masthead wants the total. Only the leading figure counts. */
const totalReadTime = (items) =>
  items.reduce((sum, item) => {
    const match = /~?\s*(\d+)\s*min/.exec(item.read_time ?? "");
    return sum + (match ? Number(match[1]) : 0);
  }, 0);

/* bank_summary lists concept slugs; the names and ratings live in
   bank.json. */
const conceptName = (slug) => {
  const concept = concepts[slug];
  if (!concept) return slug;
  return concept.familiarity == null
    ? concept.name
    : `${concept.name} (${concept.familiarity}/10)`;
};

const list = (slugs) =>
  (Array.isArray(slugs) ? slugs : slugs ? [slugs] : [])
    .map(conceptName)
    .join(" · ");

const bankRows = (summary = {}) =>
  [
    ["Open gaps", list(summary.open_gaps)],
    ["Learning", list(summary.learning)],
    ["Recently closed", list(summary.recently_closed)],
    ["Most-met without a rating", list(summary.most_met_unrated)],
    ["Asked to learn", list(summary.learning_requests)],
  ].filter(([, text]) => text);

const SCALE = Array.from({ length: 11 }, (_, n) => n);

function RatingStrip({ value, onRate }) {
  return (
    <div className="rate">
      <div
        className="rate__strip"
        role="group"
        aria-label="How well did you know this? 0 new to me, 10 knew it"
      >
        {SCALE.map((n) => (
          <button
            key={n}
            type="button"
            className={`rate__step ${value != null && n <= value ? "is-on" : ""}`}
            aria-label={`${n} of 10`}
            aria-pressed={value === n}
            onClick={() => onRate(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="rate__ends" aria-hidden="true">
        <span>New to me</span>
        <span>Knew it</span>
      </div>
    </div>
  );
}

function Story({ item, rating, onRate }) {
  return (
    <article className="story">
      {item.concept_label && (
        <p className="story__kicker">{item.concept_label}</p>
      )}
      <h4 className="story__headline">
        <a href={item.url} target="_blank" rel="noopener noreferrer">
          {item.title}
        </a>
      </h4>
      <p className="story__body">{item.summary}</p>
      {item.also?.length > 0 && (
        <ul className="story__also">
          {item.also.map((link) => (
            <li key={link.url}>
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                {link.title}
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="story__meta">
        <span>{item.provenance}</span>
        <span>{item.read_time}</span>
      </p>
      <RatingStrip value={rating} onRate={onRate} />
    </article>
  );
}

export default function DailyReport({ onClose, closing, style }) {
  const brief = EDITION;
  const [ratings, setRatings] = useState(loadRatings);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rate = (id, value) => {
    setRatings((current) => {
      const next = { ...current, [id]: value };
      saveRatings(next);
      return next;
    });
  };

  const sections = (brief?.sections ?? [])
    .map((section) => ({
      ...section,
      items: brief.items.filter((item) => item.section === section.key),
    }))
    .filter((section) => section.items.length > 0);

  const bank = bankRows(brief?.bank_summary);
  const minutes = brief ? totalReadTime(brief.items) : 0;

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
            {brief && (
              <p className="paper__ears">
                <span>No. {EDITION_NO}</span>
                <span>{formatDate(brief.date)}</span>
                <span>{brief.items.length} items</span>
              </p>
            )}
            <h2 className="paper__title">The Daily Report</h2>
            <p className="paper__tagline">Delivering insights, one day at a time</p>
          </header>

          {!brief && (
            <section className="paper__lede">
              <p className="paper__standfirst">
                No edition yet. The first one lands at 6am.
              </p>
            </section>
          )}

          {brief && (
            <section className="paper__lede">
              <p className="paper__standfirst">{brief.through_line}</p>
              {minutes > 0 && (
                <p className="paper__readtime">
                  ~{minutes} min if you read everything; skim titles and pick
                </p>
              )}
            </section>
          )}

          {sections.map((section) => (
            <section key={section.key} className="paper__section">
              <header className="paper__section-head">
                <h3 className="paper__section-title">{section.title}</h3>
                {section.sub && <p className="paper__section-sub">{section.sub}</p>}
              </header>
              <div className="paper__stories">
                {section.items.map((item) => (
                  <Story
                    key={item.id}
                    item={item}
                    rating={ratings[item.id] ?? null}
                    onRate={(value) => rate(item.id, value)}
                  />
                ))}
              </div>
            </section>
          ))}

          {brief && (
            <footer className="paper__back">
              {bank.length > 0 && (
                <section className="paper__note">
                  <h3 className="paper__section-title">Bank</h3>
                  <dl className="bank">
                    {bank.map(([label, text]) => (
                      <div key={label} className="bank__row">
                        <dt>{label}</dt>
                        <dd>{text}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}
              {brief.source_ledger_text && (
                <section className="paper__note">
                  <h3 className="paper__section-title">Sources</h3>
                  <p className="paper__sources">{brief.source_ledger_text}</p>
                </section>
              )}
            </footer>
          )}
        </article>
      </div>
    </div>
  );
}
