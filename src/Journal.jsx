import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import "./Journal.css";

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
const BOOKS = [
  {
    id: "long-way-round",
    spine: "book2",
    n: 21,
    lean: "0deg",
    tint: "hue-rotate(-6deg) saturate(1.05)",
    title: "The Long Way Round",
    date: "Aug 2026",
    blurb: "Three weeks, no fixed route, one very patient rental car.",
    bg: "#2f2a1c",
    ink: "#e6d6a8",
    body: [
      "I left with a full tank and a vague idea that the coast road went all the way north, which turned out to be true in the way most things are true on a map and not on the ground.",
      "What I remember is not the driving. It is the specific quiet of a petrol station at four in the afternoon in a town whose name I never learned, eating crisps, entirely unreachable.",
    ],
  },
  {
    id: "kitchen-notes",
    spine: "book1",
    n: 19,
    lean: "0deg",
    tint: "hue-rotate(28deg) saturate(0.95) brightness(1.04)",
    title: "Kitchen Notes",
    date: "Jul 2026",
    blurb: "What I learned rewriting the same dal fourteen times.",
    bg: "#2b3520",
    ink: "#dfe8c0",
    body: [
      "Fourteen attempts, and the one that worked was the one where I stopped adding things. The recipe got shorter every week until it was four ingredients and a temperature.",
      "This is a lesson about food and it is obviously not only about food, which is why it took fourteen tries to hear it.",
    ],
  },
  {
    id: "on-shipping",
    spine: "book4",
    n: 22.5,
    lean: "0deg",
    tint: "hue-rotate(-52deg) saturate(1.1)",
    title: "On Shipping Before You're Ready",
    date: "May 2026",
    blurb: "An argument with myself about scope, in four parts.",
    bg: "#1e2a3a",
    ink: "#cfe0f0",
    body: [
      "Part one is that you are never ready. Part two is that the thing you would have added was wrong anyway. Parts three and four are just those two again, louder.",
      "I still lose this argument roughly half the time, which I have decided is the correct hit rate for an argument worth having.",
    ],
  },
  {
    id: "field-recordings",
    spine: "book3",
    n: 18,
    lean: "-4.5deg",
    tint: "hue-rotate(14deg) saturate(0.9)",
    title: "Field Recordings",
    date: "Mar 2026",
    blurb: "Collecting sound instead of photographs for a month.",
    bg: "#243230",
    ink: "#cfe6dd",
    body: [
      "A photograph decides where to look for you. A recording refuses to, and hands you back the room exactly as loud and as boring as it was.",
      "Thirty days of files, and the best one is ninety seconds of rain on a skylight with somebody upstairs moving a chair.",
    ],
  },
  {
    id: "small-hours",
    spine: "book2",
    n: 20,
    lean: "0deg",
    tint: "hue-rotate(112deg) saturate(0.72) brightness(0.96)",
    title: "The Small Hours",
    date: "Feb 2026",
    blurb: "On the particular clarity of working at 2am.",
    bg: "#1b1b2c",
    ink: "#d2cfe8",
    body: [
      "Nothing is actually clearer at two in the morning. What changes is that nothing else is asking for anything, and the difference between those two feelings is very hard to detect from the inside.",
      "I have written some of my best work then, and also sent some of my worst emails. The record is not as one-sided as it feels at the time.",
    ],
  },
  {
    id: "borrowed-light",
    spine: "book4",
    n: 21.5,
    lean: "0deg",
    tint: "hue-rotate(-88deg) saturate(1.05)",
    title: "Borrowed Light",
    date: "Nov 2025",
    blurb: "Shooting a short film with one lamp and a bedsheet.",
    bg: "#33222a",
    ink: "#f0d3cf",
    body: [
      "One lamp, one bedsheet, and a great deal of moving both around the room until the wall stopped looking like a wall.",
      "The constraint did the directing. Every shot we got is a shot that was possible, which is a narrower and much more useful set than every shot we wanted.",
    ],
  },
  {
    id: "a-year-of-drafts",
    spine: "book1",
    n: 19.5,
    lean: "0deg",
    tint: "hue-rotate(-38deg) saturate(1.18)",
    title: "A Year of Drafts",
    date: "Sep 2025",
    blurb: "Everything I started and did not finish, catalogued.",
    bg: "#3a2b1c",
    ink: "#f0dcb4",
    body: [
      "Sixty-one starts. Nine finishes. Written out as a list it looks like a failure, and read in order it looks like a method.",
      "The abandoned ones are not waste. They are the part where I found out what the finished ones were going to be about.",
    ],
  },
  {
    id: "north-of-here",
    spine: "book3",
    n: 17.5,
    lean: "3.5deg",
    tint: "hue-rotate(-24deg) saturate(1.2)",
    title: "North of Here",
    date: "Jun 2025",
    blurb: "Trains, ferries, and a week without a working phone.",
    bg: "#1f2c34",
    ink: "#cfe4ee",
    body: [
      "The phone died on the second morning and I made a decision not to fix it, which I would like to claim was principled and was in fact mostly inertia.",
      "By day four I was asking strangers for directions and getting them, badly, and arriving anyway. It is astonishing how much slack the world has in it.",
    ],
  },
  {
    id: "against-the-grid",
    spine: "book2",
    n: 20.5,
    lean: "0deg",
    tint: "hue-rotate(56deg) saturate(0.8)",
    title: "Against the Grid",
    date: "Apr 2025",
    blurb: "Why the layouts I like least are the ones I trust most.",
    bg: "#2c2135",
    ink: "#e2d0ee",
    body: [
      "A grid is a promise that everything is the same kind of thing. Most of what I want to put on a page is not the same kind of thing.",
      "So I break it, and then I spend a week putting back exactly as much of it as the page needs to stay readable. That week is the actual design work.",
    ],
  },
];

/* Propped face-out at the end of the row, the way a bookshop turns one
   title toward the room. */
const DISPLAY_BOOK = {
  id: "the-index",
  n: 19,
  title: "The Index",
  date: "Jan 2025",
  blurb: "Where all of this started — a note to myself, kept.",
  bg: "#33251a",
  ink: "#f2ddb8",
  body: [
    "The first entry was a note reminding me to keep notes, which is either very tidy or very stupid depending on how the week is going.",
    "Everything on this shelf grew out of it. I have not gone back and edited it, and I am not going to.",
  ],
};

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
  { kind: "display", ...DISPLAY_BOOK },
  { kind: "decor", ...SHELF_DECOR.headphones },
];

const ALL_ENTRIES = [...BOOKS, DISPLAY_BOOK];

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
          <p className="entry__blurb">{entry.blurb}</p>
          {entry.body?.map((para) => (
            <p key={para.slice(0, 24)} className="entry__para">
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
            Ten entries &middot; 2025&ndash;2026
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
                <span className="journal-index__blurb">{entry.blurb}</span>
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
