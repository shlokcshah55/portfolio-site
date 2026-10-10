import { useEffect, useState } from "react";
import { BRIEFS } from "./briefs";
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
      {item.concept && <p className="story__kicker">{item.concept}</p>}
      <h4 className="story__headline">
        <a href={item.url} target="_blank" rel="noopener noreferrer">
          {item.title}
        </a>
      </h4>
      <p className="story__body">{item.body}</p>
      <p className="story__meta">
        <span>{item.prov}</span>
        <span>{item.read}</span>
      </p>
      <RatingStrip value={rating} onRate={onRate} />
    </article>
  );
}

export default function DailyReport({ onClose, closing, style }) {
  const [brief] = BRIEFS;
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

  const sections = brief.sections
    .map((section) => ({
      ...section,
      items: brief.items.filter((item) => item.section === section.key),
    }))
    .filter((section) => section.items.length > 0);

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
              <span>No. {brief.edition}</span>
              <span>{formatDate(brief.date)}</span>
              <span>{brief.itemCount} items</span>
            </p>
            <h2 className="paper__title">The Daily Report</h2>
            <p className="paper__tagline">Delivering insights, one day at a time</p>
          </header>

          <section className="paper__lede">
            <p className="paper__standfirst">{brief.lede}</p>
            <p className="paper__readtime">{brief.readTime}</p>
          </section>

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

          <footer className="paper__back">
            <section className="paper__note">
              <h3 className="paper__section-title">Bank</h3>
              <dl className="bank">
                {brief.bank.map((entry) => (
                  <div key={entry.label} className="bank__row">
                    <dt>{entry.label}</dt>
                    <dd>{entry.text}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="paper__note">
              <h3 className="paper__section-title">Sources</h3>
              <p className="paper__sources">{brief.sources}</p>
            </section>
          </footer>
        </article>
      </div>
    </div>
  );
}
