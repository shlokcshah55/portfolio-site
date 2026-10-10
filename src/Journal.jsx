import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import "./Journal.css";
import journal from "./data/journal/entries.json";

const ART = "/bookshelf/trim";

/* Aspect ratio (width / height) of each trimmed PNG. A book is sized
   by height alone and derives its width from this, so the artwork is
   never stretched no matter how the row is laid out. */
const SPINES = {
  book1: {
    src: `${ART}/book1.png`,
    cover: `${ART}/cover-book1.png`,
    ar: 201 / 568,
  },
  book2: {
    src: `${ART}/book2.png`,
    cover: `${ART}/cover-book2.png`,
    ar: 129 / 630,
  },
  book3: {
    src: `${ART}/book3.png`,
    cover: `${ART}/cover-book3.png`,
    ar: 161 / 559,
  },
  book4: {
    src: `${ART}/book4.png`,
    cover: `${ART}/cover-book4.png`,
    ar: 227 / 641,
  },
};

const DISPLAY = { src: `${ART}/book3full.png`, ar: 231 / 546 };

/* Height in shelf units (`n`); width falls out of n x aspect ratio, so
   the row scales as one object off --unit in Journal.css. The row is a
   rail now rather than a single screenful, so nothing here is competing
   for a fixed width budget — books can be added freely.

   Only four spine illustrations exist, so each entry also carries a
   small hue/saturation shift. It reaches the faces as --tint and is
   applied to leaf nodes only; on the book itself a filter would flatten
   the 3D.

   `bg`/`ink` are the entry's own two colours. They wash across the room
   as the book passes the centre of the rail, and the reading view is
   painted entirely in them. */
/* Entries are synced weekly from the Writing database in Notion into
   src/data/journal/entries.json (newest first). Each entry carries its
   own spine, size, tint and colours under `style`, assigned once at
   first sync so a book never changes look between syncs.

   The newest entry is propped face-out at the end of the row, the way a
   bookshop turns one title toward the room; the rest stand as spines. */
const ENTRIES = journal.entries.map(({ style, ...entry }) => ({
  ...style,
  ...entry,
}));

const [NEWEST, ...OLDER] = ENTRIES;

const BOOKS = OLDER;

const DISPLAY_BOOK = NEWEST
  ? {
      ...NEWEST,
      spine: undefined,
      n: journal.display?.n ?? 19,
    }
  : null;

/* Decor. Everything here stands in the row and rests on the plank, like
   the books do. Nothing is placed in front of them: an object floating
   at positive z has no shelf surface under it in this model — the plank
   is a billboard below the books, not a horizontal plane — so it reads
   as stuck to the glass rather than sitting on a shelf, and it covers
   the spines behind it.

   `n` is height in shelf units; `ar` is only used to keep the artwork
   honest. On a rail there is width to spare, so these are spacing as
   much as decoration — they break the row into readable groups. */
const SHELF_DECOR = {
  plant: { id: "plant", src: `${ART}/plantdecor.png`, n: 8, ar: 262 / 365 },
  candle: { id: "candle", src: `${ART}/candle.png`, n: 9.5, ar: 309 / 479 },
  headphones: {
    id: "headphones",
    src: `${ART}/decor2.png`,
    n: 12,
    ar: 403 / 621,
  },
  trinket: { id: "trinket", src: `${ART}/decor3.png`, n: 6.5, ar: 222 / 226 },
};

/* Left to right, newest first, ending with the face-out display copy.
   Decor is spaced through the row rather than parked at the ends —
   on a rail you scroll past it, so it paces the shelf. */
const SHELF_ROW = [
  { kind: "decor", ...SHELF_DECOR.plant },
  ...BOOKS.slice(0, 3).map((b) => ({ kind: "book", ...b })),
  { kind: "decor", ...SHELF_DECOR.candle },
  ...BOOKS.slice(3, 6).map((b) => ({ kind: "book", ...b })),
  { kind: "decor", ...SHELF_DECOR.trinket },
  ...BOOKS.slice(6).map((b) => ({ kind: "book", ...b })),
  ...(DISPLAY_BOOK ? [{ kind: "display", ...DISPLAY_BOOK }] : []),
  { kind: "decor", ...SHELF_DECOR.headphones },
];

const NUMBER_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const YEARS = [...new Set(ENTRIES.map((e) => e.date.slice(-4)))].sort();
const RAIL_HINT = `${NUMBER_WORDS[ENTRIES.length] ?? ENTRIES.length} ${
  ENTRIES.length === 1 ? "entry" : "entries"
}${YEARS.length ? ` \u00b7 ${YEARS[0]}${YEARS.length > 1 ? `\u2013${YEARS.at(-1)}` : ""}` : ""}`;

const ALL_ENTRIES = DISPLAY_BOOK ? [DISPLAY_BOOK, ...BOOKS] : BOOKS;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/* The row is wider than the shelf at full size, so rather than scroll or
   drag it into view, the whole row is scaled down to fit the viewport
   and held centred — every book stays visible and in place. */
function useFitShelf(containerRef, spaceRef, trackRef, enabled) {
  useLayoutEffect(() => {
    if (!enabled) return undefined;
    const container = containerRef.current;
    const space = spaceRef.current;
    const track = trackRef.current;
    if (!container || !space || !track) return undefined;

    const measure = () => {
      const natural = track.scrollWidth;
      const available = container.clientWidth;
      const fit = natural > available ? available / natural : 1;
      space.style.setProperty("--fit", `${fit}`);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    observer.observe(container);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [enabled, containerRef, spaceRef, trackRef]);
}

function Decor({ item }) {
  return (
    <li className="shelf__decor" style={{ "--n": item.n }} aria-hidden="true">
      <img src={item.src} alt="" draggable="false" />
    </li>
  );
}

/* The four faces of a book, shared by the shelf and the reading view.
   The spine faces out; the top edge is the only page surface a viewer
   can ever see from the front. Both covers exist because perspective
   shows them on any book away from the centre of the screen. The
   fore-edge points into the wall and is never drawn. */
function BookFaces() {
  return (
    <>
      <span className="book__face book__face--spine" />
      <span className="book__face book__face--top" />
      <span className="book__face book__face--cover book__face--cover-left" />
      <span className="book__face book__face--cover book__face--cover-right" />
    </>
  );
}

const spineVars = (entry) => {
  const spine = SPINES[entry.spine];
  return {
    "--ar": spine.ar,
    "--tint": entry.tint,
    "--spine-img": `url(${spine.src})`,
    "--cover-img": `url(${spine.cover})`,
  };
};

function Book({ entry, onOpen }) {
  return (
    <li
      className="book-slot"
      style={{ "--n": entry.n, "--lean": entry.lean, ...spineVars(entry) }}
    >
      <div className="book" aria-hidden="true">
        <BookFaces />
      </div>

      {/* The hit target stays flat and stationary while the book
          animates away from it, so the pointer never falls out of
          its own hover state. */}
      <button
        type="button"
        className="book-hit"
        onClick={(event) => onOpen(entry, event.currentTarget)}
        aria-label={`${entry.title} — ${entry.date}`}
      />

      <span className="book-title" aria-hidden="true">
        <span className="book-title__name">{entry.title}</span>
        <span className="book-title__date">{entry.date}</span>
      </span>
    </li>
  );
}

function DisplayBook({ entry, onOpen }) {
  return (
    <li
      className="book-slot book-slot--display"
      style={{ "--n": entry.n, "--ar": DISPLAY.ar, "--lean": "0deg" }}
    >
      <div className="book book--display" aria-hidden="true">
        <span className="book__face book__face--cover" />
      </div>

      <button
        type="button"
        className="book-hit"
        onClick={(event) => onOpen(entry, event.currentTarget)}
        aria-label={`${entry.title} — ${entry.date}`}
      />

      <span className="book-title" aria-hidden="true">
        <span className="book-title__name">{entry.title}</span>
        <span className="book-title__date">{entry.date}</span>
      </span>
    </li>
  );
}

/* Resting angle of the reading copy: turned just far enough to show it
   has a cover and a thickness, with the spine still square-on to the
   reader. The spine is the only real artwork each book has —
   cover-bookN.png is a strip of its bookcloth, a texture rather than a
   design — so turning any further trades the good art for a blank
   panel. The drag range is wide enough to satisfy a reader who wants to
   look, and it always settles back here. */
const REST_SPIN = -26;
const SPIN_LIMIT = 55;

/* The full-bleed reading view. Painted entirely in the entry's own two
   colours, with the book flown in from wherever it stood on the shelf
   and the text arriving a beat later — press.stripe.com holds its copy
   back half a second so the book lands first, and the pause is most of
   why the transition reads as composed rather than fast. */
function JournalEntry({ entry, from, onBack }) {
  const flyRef = useRef(null);
  const bookRef = useRef(null);
  const [landed, setLanded] = useState(false);
  const spin = useRef(REST_SPIN);

  /* FLIP: the book is laid out where it belongs, then offset back to
     the rect it was clicked at and released. Measuring after layout is
     what lets the resting slot stay fully responsive. */
  useLayoutEffect(() => {
    const el = flyRef.current;
    if (!el || !from) return;
    const to = el.getBoundingClientRect();
    if (!to.height) return;

    el.style.setProperty(
      "--fx",
      `${from.left + from.width / 2 - (to.left + to.width / 2)}px`,
    );
    el.style.setProperty(
      "--fy",
      `${from.top + from.height / 2 - (to.top + to.height / 2)}px`,
    );
    el.style.setProperty("--fs", `${from.height / to.height}`);

    /* One frame is enough for the offset above to be painted before the
       transition starts. The timeout is a backstop: rAF is starved in a
       background tab, and without it the book would sit permanently at
       its shelf position with the copy never arriving. */
    const raf = requestAnimationFrame(() => setLanded(true));
    const backstop = setTimeout(() => setLanded(true), 60);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(backstop);
    };
  }, [from]);

  /* Drag the cover round its own axis, the way you would turn a book
     in your hands. Released, it eases back to the resting angle. */
  useEffect(() => {
    const el = bookRef.current;
    if (!el) return undefined;

    let dragging = false;
    let lastX = 0;

    const write = () => el.style.setProperty("--spin", `${spin.current}deg`);

    const onDown = (event) => {
      dragging = true;
      lastX = event.clientX;
      el.classList.add("is-turning");
      el.setPointerCapture?.(event.pointerId);
    };

    const onMove = (event) => {
      if (!dragging) return;
      spin.current = clamp(
        spin.current + (event.clientX - lastX) * 0.4,
        REST_SPIN - SPIN_LIMIT,
        REST_SPIN + SPIN_LIMIT,
      );
      lastX = event.clientX;
      write();
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove("is-turning");
      spin.current = REST_SPIN;
      write();
    };

    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const isDisplay = !entry.spine;

  return (
    <section
      className={`entry ${landed ? "is-landed" : ""}`}
      style={{ "--bg": entry.bg, "--ink": entry.ink }}
      aria-label={entry.title}
    >
      <button type="button" className="entry__back" onClick={onBack}>
        <span aria-hidden="true">&larr;</span> Journal
      </button>

      <div className="entry__body">
        <div className="entry__left">
          <div className="entry__fly" ref={flyRef}>
            <div
              className="book-figure"
              style={
                isDisplay
                  ? { "--n": entry.n, "--ar": DISPLAY.ar }
                  : { "--n": entry.n, ...spineVars(entry) }
              }
            >
              <div
                className={`book ${isDisplay ? "book--display" : ""}`}
                ref={bookRef}
                style={{ "--spin": `${isDisplay ? 0 : REST_SPIN}deg` }}
              >
                {isDisplay ? (
                  <span className="book__face book__face--cover" />
                ) : (
                  <BookFaces />
                )}
              </div>
            </div>
          </div>
          {!isDisplay && (
            <span className="entry__turn" aria-hidden="true">
              drag to turn
            </span>
          )}
        </div>

        <div className="entry__right">
          <span className="entry__date">{entry.date}</span>
          <h2 className="entry__title">{entry.title}</h2>
          <div className="entry__rule" aria-hidden="true" />
          {entry.blurb && <p className="entry__blurb">{entry.blurb}</p>}
          {entry.body?.map((para, i) => (
            <p key={i} className="entry__para">
              {para}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Journal({ onClose, closing, style }) {
  const viewRef = useRef(null);
  const railRef = useRef(null);
  const spaceRef = useRef(null);
  const trackRef = useRef(null);
  const [active, setActive] = useState(null);

  useFitShelf(railRef, spaceRef, trackRef, !closing);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      if (active) setActive(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onClose]);

  /* The clicked rect is captured here rather than in the reading view
     because by the time that view mounts the shelf is already fading —
     the same reason App.jsx reads the tile's rect at the moment of the
     click to seed the zoom origin. */
  const open = useCallback((entry, element) => {
    setActive({ entry, from: element?.getBoundingClientRect() ?? null });
  }, []);

  /* With every book on screen at once there is no single "current" one
     to light the room, so the wash just settles on whatever sits in the
     middle of the row. */
  const lit = SHELF_ROW.filter(
    (item) => item.kind === "book" || item.kind === "display",
  );
  const roomTint = lit[Math.floor(lit.length / 2)]?.bg;

  return (
    <div
      ref={viewRef}
      className={`journal-view ${closing ? "is-closing" : ""} ${
        active ? "is-reading" : ""
      }`}
      style={{
        ...style,
        "--lit": roomTint,
      }}
    >
      <div className="journal-wall" aria-hidden="true" />
      <div className="journal-vignette" aria-hidden="true" />

      <div className="journal-scroll">
        <header className="journal-head">
          <button type="button" className="journal-back" onClick={onClose}>
            <span aria-hidden="true">&larr;</span> Back
          </button>
          <h1 className="journal-title">Journal</h1>
          <p className="journal-sub">
            Notes, half-finished arguments, and things worth keeping. Pull
            one off the shelf.
          </p>
        </header>

        <div className="rail" ref={railRef}>
          <section className="shelf">
            <div className="shelf__space" ref={spaceRef}>
              <ul className="shelf__books" ref={trackRef}>
                {SHELF_ROW.map((item, i) =>
                  item.kind === "book" ? (
                    <Book key={item.id} entry={item} onOpen={open} />
                  ) : item.kind === "display" ? (
                    <DisplayBook key={item.id} entry={item} onOpen={open} />
                  ) : (
                    <Decor key={`${item.id}-${i}`} item={item} />
                  ),
                )}
              </ul>

              <div className="shelf__plank" aria-hidden="true" />
            </div>
          </section>

          <div className="rail__hint" aria-hidden="true">
            <span className="rail__hint-line" />
            {RAIL_HINT}
            <span className="rail__hint-line" />
          </div>
        </div>

        {/* Touch devices get no hover, and a 3D pull-out is not worth
            faking with a tap — so the shelf is swapped for a plain
            index below 900px. It opens the same reading view. */}
        <ul className="journal-index">
          {ALL_ENTRIES.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={(event) => open(entry, event.currentTarget)}
              >
                <span className="journal-index__date">{entry.date}</span>
                <span className="journal-index__name">{entry.title}</span>
                {entry.blurb && (
                  <span className="journal-index__blurb">{entry.blurb}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {active && (
        <JournalEntry
          key={active.entry.id}
          entry={active.entry}
          from={active.from}
          onBack={() => setActive(null)}
        />
      )}
    </div>
  );
}
