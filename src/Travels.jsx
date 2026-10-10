import { useEffect, useMemo, useState } from "react";
import WorldMap, { STAGE_W, STAGE_H, MAP_OFFSET_X, MAP_OFFSET_Y, project } from "./WorldMap";
import "./Travels.css";

/* Ropes and photos are laid out in WorldMap's "stage" space (see
   STAGE_W/STAGE_H there) — a box larger than the map itself, which is
   inset within it by MAP_OFFSET_X/Y. That gutter is what gives the
   photo cards room to sit well clear of the coastline. `toStage` moves
   a point from the map's own coordinate space (what `project()`
   returns) into the shared stage space; frame positions below are
   already given directly in stage space, since they're hand-placed
   rather than derived from real geography.

   A rope runs the *full* distance from the country's real pin to the
   photo — it's meant to look like a string pinned to the country and
   tacked up on the board around it, so it should visibly touch the
   country, not stop short at the map's own edge. Only the photo card
   itself is kept off the map (see the FEATURED frame coordinates
   below, all chosen well outside the map's rectangle). */
const toStage = ({ x, y }) => ({ x: x + MAP_OFFSET_X, y: y + MAP_OFFSET_Y });

/* The six places with a photo and something written about them. `pin`
   is a real [lon, lat] — run through `project()` below to land exactly
   on the country the map already draws, no hand calibration needed.
   USA and France's Natural Earth polygons are MultiPolygons that
   include distant territories (Alaska/Hawaii; French Guiana etc.), so
   this is a hand-picked mainland point rather than a polygon centroid,
   which those territories would skew. Swap `photo` for a real image
   path any time — with none given, the frame falls back to a tinted
   card carrying the place's initial. `pages` is an array of pages,
   each an array of paragraphs — every entry gets one page except USA,
   which gets two. */
const FEATURED = [
  {
    id: "usa",
    place: "USA",
    matchName: "United States of America",
    country: "United States",
    date: "2024 – 2025",
    pin: [-98.5, 39.8],
    frame: { x: 55, y: 50 },
    size: 1.05,
    tilt: "5deg",
    rope: "wavy",
    tint: "hue-rotate(0deg) saturate(0.6) brightness(1.05)",
    blurb: "Walked forty blocks in the cold rather than take the subway.",
    pages: [
      [
        "Every borough I visited felt like it was arguing with the other four about what the city actually is.",
        "The best meal of the trip cost eleven dollars and came out of a cart.",
        "I'd go back just for the walk across the Manhattan Bridge at golden hour.",
      ],
      [
        "Drove the Pacific Coast Highway with no real plan, which is the only way it actually works.",
        "Every stop added an hour I hadn't budgeted for, and I don't regret a single one.",
        "Big Sur made me pull over for photos I already knew wouldn't do it justice.",
      ],
    ],
  },
  {
    id: "mexico",
    place: "Mexico",
    matchName: "Mexico",
    country: "Mexico",
    date: "Mar 2025",
    pin: [-99.1, 19.4],
    frame: { x: 45, y: 370 },
    size: 1,
    tilt: "-4deg",
    rope: "straight",
    tint: "hue-rotate(10deg) saturate(1.1)",
    blurb: "Tacos al pastor from a stand with no name, twice a day.",
    pages: [
      [
        "Mexico City's murals took me down streets I never would have found on a map.",
        "I ate more corn in a week than I usually do in a year, no complaints.",
        "The mezcalerías close when they close, not before — I learned that the hard way once.",
      ],
    ],
  },
  {
    id: "belize",
    place: "Belize",
    matchName: "Belize",
    country: "Belize",
    date: "Apr 2025",
    pin: [-88.2, 17.5],
    frame: { x: 500, y: 690 },
    size: 0.9,
    tilt: "4deg",
    rope: "wavy",
    tint: "hue-rotate(-20deg) saturate(1.1)",
    blurb: "Snorkeled the barrier reef and saw more color than my camera could hold.",
    pages: [
      [
        "The Blue Hole looked exactly like the photos, which almost never happens.",
        "Belize City moves at a pace I wish I could bottle and bring home.",
        "I spent a full afternoon just watching fishing boats come in at Placencia.",
      ],
    ],
  },
  {
    id: "guatemala",
    place: "Guatemala",
    matchName: "Guatemala",
    country: "Guatemala",
    date: "Apr 2025",
    pin: [-90.5, 14.6],
    frame: { x: 300, y: 700 },
    size: 0.95,
    tilt: "-3deg",
    rope: "straight",
    tint: "hue-rotate(30deg) saturate(0.95)",
    blurb: "Climbed a volcano before sunrise to watch another one erupt across the valley.",
    pages: [
      [
        "Antigua's cobblestones are brutal on ankles and completely worth it for the view of Volcán de Fuego at dusk.",
        "Lake Atitlán is the first lake that's ever made me reconsider what a lake can look like.",
        "I drank more coffee at origin than I've ever managed to make taste the same at home.",
      ],
    ],
  },
  {
    id: "thailand",
    place: "Thailand",
    matchName: "Thailand",
    country: "Thailand",
    date: "Sep 2025",
    pin: [100.5, 13.8],
    frame: { x: 1095, y: 320 },
    size: 0.95,
    tilt: "-5deg",
    rope: "wavy",
    tint: "hue-rotate(24deg) saturate(1.1)",
    blurb: "The river ferry turned out to be the best commute I've had.",
    pages: [
      [
        "Riding the Chao Phraya at rush hour beats any tuk-tuk for actually seeing the city move.",
        "The night markets are where I did most of my thinking — too much going on to think about anything else.",
        "I still can't replicate the khao soi. I've tried four times.",
      ],
    ],
  },
  {
    id: "spain",
    place: "Spain",
    matchName: "Spain",
    country: "Spain",
    date: "May 2026",
    pin: [-3.7, 40.4],
    frame: { x: 620, y: 45 },
    size: 1.05,
    tilt: "3deg",
    rope: "straight",
    tint: "hue-rotate(-8deg) saturate(1.05)",
    blurb: "Stayed up for a sunrise churro run I have no regrets about.",
    pages: [
      [
        "Madrid taught me that dinner doesn't really start until ten, and I adjusted embarrassingly fast.",
        "The Alhambra is the rare landmark that's better in person than in every photo of it I'd seen.",
        "I still think about the jamón at a bar I can no longer find on a map.",
      ],
    ],
  },
];

/* Everywhere else I've been, with nothing written yet — just a
   highlighted country, no rope or photo. `matchName` is the exact
   Natural Earth name used by the map data (some differ from the short
   forms used in the UI, e.g. "UAE" -> "United Arab Emirates"). */
const PINS = [
  { id: "india", place: "India", matchName: "India" },
  { id: "turkey", place: "Turkey", matchName: "Turkey" },
  { id: "uae", place: "UAE", matchName: "United Arab Emirates" },
  { id: "vietnam", place: "Vietnam", matchName: "Vietnam" },
  { id: "belgium", place: "Belgium", matchName: "Belgium" },
  { id: "bulgaria", place: "Bulgaria", matchName: "Bulgaria" },
  { id: "cyprus", place: "Cyprus", matchName: "Cyprus" },
  { id: "france", place: "France", matchName: "France" },
  { id: "greece", place: "Greece", matchName: "Greece" },
  { id: "iceland", place: "Iceland", matchName: "Iceland" },
  { id: "hungary", place: "Hungary", matchName: "Hungary" },
  { id: "italy", place: "Italy", matchName: "Italy" },
  { id: "monaco", place: "Monaco", matchName: "Monaco" },
  { id: "netherlands", place: "Netherlands", matchName: "Netherlands" },
  { id: "norway", place: "Norway", matchName: "Norway" },
  { id: "poland", place: "Poland", matchName: "Poland" },
  { id: "portugal", place: "Portugal", matchName: "Portugal" },
  { id: "romania", place: "Romania", matchName: "Romania" },
  { id: "slovakia", place: "Slovakia", matchName: "Slovakia" },
  { id: "switzerland", place: "Switzerland", matchName: "Switzerland" },
  { id: "uk", place: "UK", matchName: "United Kingdom" },
];

/* Ranked by hand, not derived from any data above. */
const FAVORITES = ["Thailand", "Mexico", "USA", "Guatemala", "Belgium"];

const NEXT_TRIP = "South Africa";

const ROPE_SRC = {
  straight: "/ropes/straight.png",
  wavy: "/ropes/wavy.png",
};

/* Natural width / height of the two trimmed rope assets, as a CSS
   aspect-ratio — letting the browser derive a rope's rendered thickness
   from its width sidesteps percentage-height resolution against an
   aspect-ratio'd containing block, which not every engine handles the
   same way. */
const ROPE_ASPECT = {
  straight: "725 / 35",
  wavy: "990 / 163",
};

function Rope({ from, to, kind }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  return (
    <img
      className="rope"
      src={ROPE_SRC[kind]}
      alt=""
      aria-hidden="true"
      draggable="false"
      style={{
        left: `${(from.x / STAGE_W) * 100}%`,
        top: `${(from.y / STAGE_H) * 100}%`,
        width: `${(length / STAGE_W) * 100}%`,
        aspectRatio: ROPE_ASPECT[kind],
        transform: `rotate(${angle}deg)`,
      }}
    />
  );
}

function Pin({ x, y }) {
  return (
    <span
      className="map-pin"
      style={{ left: `${(x / STAGE_W) * 100}%`, top: `${(y / STAGE_H) * 100}%` }}
      aria-hidden="true"
    >
      <span className="map-pin__head" />
    </span>
  );
}

function Photo({ entry, onOpen }) {
  const { x, y } = entry.frame;
  return (
    <button
      type="button"
      className="photo-frame"
      style={{
        left: `${(x / STAGE_W) * 100}%`,
        top: `${(y / STAGE_H) * 100}%`,
        "--tilt": entry.tilt,
        "--scale": entry.size,
      }}
      onClick={() => onOpen(entry)}
      aria-label={`${entry.place} — ${entry.date}`}
    >
      <span className="photo-frame__pin" aria-hidden="true" />
      <span className="photo-frame__body">
        <span
          className="photo-frame__photo"
          style={entry.photo ? { backgroundImage: `url(${entry.photo})` } : undefined}
          data-fallback={!entry.photo}
        >
          {!entry.photo && (
            <span className="photo-frame__initial" style={{ filter: entry.tint }}>
              {entry.place[0]}
            </span>
          )}
        </span>
        <span className="photo-frame__caption">{entry.place}</span>
      </span>
    </button>
  );
}

function Reader({ entry, onClose }) {
  const [page, setPage] = useState(0);
  const pageCount = entry.pages.length;

  return (
    <div className="travels-reader" role="dialog" aria-modal="true">
      <button
        type="button"
        className="travels-reader__scrim"
        aria-label="Close entry"
        onClick={onClose}
      />
      <article className="travels-reader__sheet">
        <span className="travels-reader__date">
          {entry.country} &middot; {entry.date}
        </span>
        <h2>{entry.place}</h2>
        {entry.pages[page].map((para, i) => (
          <p key={i}>{para}</p>
        ))}
        <div className="travels-reader__foot">
          {pageCount > 1 && (
            <div className="travels-reader__pager">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Previous page"
              >
                &larr;
              </button>
              <span>
                {page + 1} / {pageCount}
              </span>
              <button
                type="button"
                disabled={page === pageCount - 1}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Next page"
              >
                &rarr;
              </button>
            </div>
          )}
          <button type="button" className="travels-reader__close" onClick={onClose}>
            Close
          </button>
        </div>
      </article>
    </div>
  );
}

function Stats({ total }) {
  return (
    <section className="travels-stats">
      <div className="stat-card stat-card--count">
        <span className="stat-card__pin" aria-hidden="true" />
        <span className="stat-card__number">{total}</span>
        <span className="stat-card__label">Countries Visited</span>
      </div>

      <div className="stat-card stat-card--leaderboard">
        <span className="stat-card__pin" aria-hidden="true" />
        <h3 className="stat-card__title">Favorite Countries</h3>
        <ol className="stat-card__list">
          {FAVORITES.map((place, i) => (
            <li key={place}>
              <span className="stat-card__rank">{i + 1}</span>
              <span>{place}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="stat-card stat-card--next">
        <span className="stat-card__pin" aria-hidden="true" />
        <h3 className="stat-card__title">Next Up</h3>
        <span className="stat-card__next-place">{NEXT_TRIP}</span>
        <span className="stat-card__label">Next big trip</span>
      </div>
    </section>
  );
}

export default function Travels({ onClose, closing, style }) {
  const [reader, setReader] = useState(null);
  const [hoveredCountry, setHoveredCountry] = useState(null);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      if (reader) setReader(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reader, onClose]);

  const highlight = useMemo(() => {
    const map = new Map();
    for (const entry of PINS) map.set(entry.matchName, "visited");
    for (const entry of FEATURED) map.set(entry.matchName, "featured");
    return map;
  }, []);

  const featuredByName = useMemo(
    () => new Map(FEATURED.map((entry) => [entry.matchName, entry])),
    [],
  );

  const openCountry = (name) => {
    const entry = featuredByName.get(name);
    if (entry) setReader(entry);
  };

  return (
    <div className={`travels-view ${closing ? "is-closing" : ""}`} style={style}>
      <button type="button" className="travels-back" onClick={onClose}>
        <span aria-hidden="true">&larr;</span> Back
      </button>

      <div className="travels-scroll">
        <div className="world-map-wrap">
          <WorldMap
            highlight={highlight}
            hoveredName={hoveredCountry}
            onHoverCountry={setHoveredCountry}
            onClickCountry={openCountry}
          />

          {FEATURED.map((entry) => {
            const pin = toStage(project(entry.pin));
            return <Rope key={entry.id} from={pin} to={entry.frame} kind={entry.rope} />;
          })}

          {FEATURED.map((entry) => {
            const pin = toStage(project(entry.pin));
            return <Pin key={entry.id} x={pin.x} y={pin.y} />;
          })}

          {FEATURED.map((entry) => (
            <Photo key={entry.id} entry={entry} onOpen={setReader} />
          ))}
        </div>

        <Stats total={FEATURED.length + PINS.length} />

        {/* No hover, no room for tiny map targets on a phone — a plain
            list of the featured places stands in below 900px. */}
        <ul className="travels-index">
          {FEATURED.map((entry) => (
            <li key={entry.id}>
              <button type="button" onClick={() => setReader(entry)}>
                <span className="travels-index__date">{entry.date}</span>
                <span className="travels-index__name">{entry.place}</span>
                <span className="travels-index__blurb">{entry.blurb}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {reader && <Reader entry={reader} onClose={() => setReader(null)} />}
    </div>
  );
}
