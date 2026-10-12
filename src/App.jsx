import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import CursorScrubVideo from "./CursorScrubVideo";
import Journal from "./Journal";
import DailyReport from "./DailyReport";
import Finances from "./Finances";
import Cookbook from "./Cookbook";
import useMediaQuery, { COMPACT_QUERY } from "./useMediaQuery";
import "./App.css";

/* The world-map data (d3-geo + topojson-client + the country topology)
   only matters once the Travels view actually opens, so it's kept out
   of the home page's initial bundle. */
const Travels = lazy(() => import("./Travels"));

/* Tiles that open a full-page view via the shared zoom transition,
   rather than just scrolling to a section. */
const ZOOM_VIEWS = {
  "#journal": "journal",
  "#travels": "travels",
  "#daily-report": "daily-report",
  "#finances": "finances",
  "#cooking": "cooking",
};

const VIDEO_SRC = "/scrub.mp4";

/* Kept in sync with --zoom-in / --zoom-out in App.css: the phase only
   advances once the CSS animation that drives it has finished. */
const ZOOM_IN_MS = 950;
const ZOOM_OUT_MS = 700;

/* Cursor past these fractions of the window width reveals that
   side's items; between them, both sides stay hidden. */
const LEFT_EDGE = 0.35;
const RIGHT_EDGE = 0.65;

/* Each item is placed by hand rather than on a grid: top/inset are
   percentages of the viewport, size is the image width, tilt is the
   resting rotation, and delay staggers the entrance. The deliberate
   mismatch in all four is what keeps the reveal from reading as a
   tidy two-column list.

   pullY/pullX close the gap between the label and the object. Each
   PNG has the object floating in a different amount of transparent
   padding (most are 1080x1350, newspaper/safe are 500x500), so a shared
   offset leaves some labels adrift; these are measured from each file's
   alpha bounds, in units of the rendered image width.

   art is the same alpha box in full — x and y as fractions of the
   image's width and height, ratio as height over width — so the phone
   tile grid can crop each image to its object (see artStyle). */
const REVEAL_ITEMS = [
  {
    side: "left",
    img: "/newspaper.png",
    art: { x: [0.256, 0.742], y: [0.358, 0.638], ratio: 1 },
    label: "Daily report",
    href: "#daily-report",
    /* Tucked into the corner above the name; the PNG's top third is
       transparent, so the box starts above the viewport. */
    top: "-6%",
    inset: "5%",
    size: "clamp(9.5rem, 18vw, 16rem)",
    tilt: "6deg",
    delay: "0.05s",
    pullY: 0.32,
    pullX: 0.26,
  },
  {
    side: "left",
    img: "/journal.png",
    art: { x: [0.132, 0.788], y: [0.284, 0.654], ratio: 1.25 },
    label: "Journal",
    href: "#journal",
    top: "34%",
    inset: "22%",
    size: "clamp(11rem, 22vw, 20.5rem)",
    tilt: "-9deg",
    delay: "0s",
    pullY: 0.39,
    pullX: 0.13,
  },
  {
    side: "left",
    img: "/work.png",
    art: { x: [0.204, 0.769], y: [0.239, 0.733], ratio: 1.25 },
    label: "Work",
    href: "#work",
    top: "58%",
    inset: "13%",
    size: "clamp(9rem, 17vw, 15.5rem)",
    tilt: "7deg",
    delay: "0.11s",
    pullY: 0.29,
    pullX: 0.2,
  },
  {
    side: "right",
    img: "/travel.png",
    art: { x: [0.321, 0.751], y: [0.309, 0.559], ratio: 1.25 },
    label: "Travels",
    href: "#travels",
    top: "6%",
    inset: "17%",
    size: "clamp(12rem, 21vw, 25rem)",
    tilt: "10deg",
    delay: "0.06s",
    pullY: 0.51,
    pullX: 0.25,
  },
  {
    side: "right",
    img: "/cook.png",
    art: { x: [0.088, 0.944], y: [0.348, 0.553], ratio: 1.25 },
    label: "Cooking",
    href: "#cooking",
    /* Raised so the pot and its label stay clear of the info block
       in the bottom-right corner on shorter viewports. */
    top: "38%",
    inset: "15%",
    size: "clamp(10.5rem, 21vw, 19rem)",
    tilt: "5deg",
    delay: "0.2s",
    pullY: 0.52,
    pullX: 0.06,
  },
  {
    side: "right",
    img: "/safe.png",
    art: { x: [0.278, 0.638], y: [0.318, 0.704], ratio: 1 },
    label: "Finances",
    href: "#finances",
    top: "10%",
    inset: "0%",
    size: "clamp(10rem, 20vw, 18rem)",
    tilt: "-6deg",
    delay: "0.17s",
    pullY: 0.26,
    pullX: 0.36,
  },
];

/* Scale and offset, as percentages of a square tile, that put an
   image's visible object centred in the tile at 86% of its width. */
function artStyle({ x: [x0, x1], y: [y0, y1], ratio }) {
  const boxW = x1 - x0;
  const boxH = (y1 - y0) * ratio;
  const scale = 0.86 / Math.max(boxW, boxH);
  return {
    "--art-w": `${scale * 100}%`,
    "--art-x": `${50 - ((x0 + x1) / 2) * scale * 100}%`,
    "--art-y": `${50 - ((y0 + y1) / 2) * ratio * scale * 100}%`,
  };
}

function useHoverSide() {
  const [side, setSide] = useState(null);

  useEffect(() => {
    const onPointerMove = (event) => {
      const x = event.clientX / Math.max(window.innerWidth, 1);
      setSide(x < LEFT_EDGE ? "left" : x > RIGHT_EDGE ? "right" : null);
    };
    const onPointerLeave = () => setSide(null);

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener(
        "pointerleave",
        onPointerLeave,
      );
    };
  }, []);

  return side;
}

/* Four phases so the two views can overlap while the camera moves:
   home -> opening (both on screen, home rushing past the viewer) ->
   journal (home parked off-camera) -> closing -> home. */
function useZoomRoute() {
  const [phase, setPhase] = useState("home");
  const [view, setView] = useState(null);
  const [origin, setOrigin] = useState({ x: 50, y: 50, px: null, py: null });
  const [runId, setRunId] = useState(0);

  const open = useCallback((element, viewId) => {
    const rect = element.getBoundingClientRect();
    setOrigin({
      /* Viewport fractions, for the fixed-position view growing in. */
      x: ((rect.left + rect.width / 2) / window.innerWidth) * 100,
      y: ((rect.top + rect.height / 2) / window.innerHeight) * 100,
      /* Page pixels, for the home stage scaling away: on a phone the
         stage runs taller than the viewport and the tile may have been
         scrolled to, so a viewport percentage would land elsewhere. */
      px: rect.left + rect.width / 2 + window.scrollX,
      py: rect.top + rect.height / 2 + window.scrollY,
    });
    setRunId((n) => n + 1);
    setView(viewId);
    setPhase("opening");
    window.history.pushState({ view: viewId }, "", `#${viewId}`);
  }, []);

  const close = useCallback(() => {
    setPhase((current) => (current === "open" ? "closing" : current));
    if (window.history.state?.view) window.history.back();
  }, []);

  useEffect(() => {
    if (phase === "opening") {
      const id = setTimeout(() => setPhase("open"), ZOOM_IN_MS);
      return () => clearTimeout(id);
    }
    if (phase === "closing") {
      const id = setTimeout(() => setPhase("home"), ZOOM_OUT_MS);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [phase]);

  /* The browser back button reads as "leave the journal", and the
     scaled-up home view would otherwise stretch the page. */
  useEffect(() => {
    const onPop = () =>
      setPhase((current) => (current === "home" ? current : "closing"));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("is-zooming", phase !== "home");
    return () => document.body.classList.remove("is-zooming");
  }, [phase]);

  return { phase, view, origin, runId, open, close };
}

export default function App() {
  const hoverSide = useHoverSide();
  const { phase, view, origin, runId, open, close } = useZoomRoute();
  /* Phones get no hover and a portrait viewport, so the home page
     reflows: the character is cropped tall rather than letterboxed,
     and the hover-reveal tiles become a grid under the hero. */
  const compact = useMediaQuery(COMPACT_QUERY);
  /* Phone-only menu behind the button in the nav; lists every section
     so none of them depends on scrolling down to the tile grid. */
  const [menuOpen, setMenuOpen] = useState(false);
  /* Leaving the phone layout (a rotation to landscape on a tablet,
     say) takes the menu button with it, so the menu goes too. Declared
     before the effect below, which reads it. */
  const showMenu = menuOpen && compact;

  useEffect(() => {
    if (!showMenu) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.classList.add("is-menu-open");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("is-menu-open");
    };
  }, [showMenu]);


  const stageState =
    phase === "opening"
      ? "is-leaving"
      : phase === "open"
        ? "is-away"
        : phase === "closing"
          ? "is-returning"
          : "";

  /* Opens a zoom view from any tile, or falls through to the plain
     anchor for sections that are just scrolled to. */
  const tileClick = (href) =>
    ZOOM_VIEWS[href]
      ? (event) => {
          event.preventDefault();
          setMenuOpen(false);
          open(event.currentTarget, ZOOM_VIEWS[href]);
        }
      : () => setMenuOpen(false);

  return (
    <>
      <main
        className={`stage ${stageState}`}
        style={{
          "--zx": `${origin.x}%`,
          "--zy": `${origin.y}%`,
          "--sx": origin.px == null ? `${origin.x}%` : `${origin.px}px`,
          "--sy": origin.py == null ? `${origin.y}%` : `${origin.py}px`,
        }}
        aria-hidden={phase === "open"}
      >
        <h1 className="sr-only">Shlok Shah</h1>

        <div className="hero">
          <nav className="site-nav">
            <button
              type="button"
              className="menu-btn"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={showMenu}
              aria-controls="site-menu"
              onClick={() => setMenuOpen((isOpen) => !isOpen)}
            >
              <span className="menu-btn__bar" />
              <span className="menu-btn__bar" />
            </button>
            <div className="nav-links">
              <a href="#work">Work</a>
              <a href="#about">About</a>
              <a href="#contact">Contact</a>
            </div>
            <a className="nav-cta" href="#contact">
              Get In Touch
            </a>
          </nav>

          <div className="name-layer" aria-hidden="true">
            <span className="name-word name-word-shlok">Shlok</span>
            <span className="name-word name-word-shah">Shah</span>
          </div>

          <div className="reveal-layer">
            {REVEAL_ITEMS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className={`reveal-item reveal-${item.side} ${
                  hoverSide === item.side ? "is-visible" : ""
                }`}
                style={{
                  top: item.top,
                  [item.side]: item.inset,
                  "--size": item.size,
                  "--tilt": item.tilt,
                  "--delay": item.delay,
                  "--pull-y": item.pullY,
                  "--pull-x": item.pullX,
                }}
                tabIndex={hoverSide === item.side ? 0 : -1}
                aria-hidden={hoverSide !== item.side}
                onClick={tileClick(item.href)}
              >
                <img src={item.img} alt="" draggable="false" />
                <span className="reveal-label">{item.label}</span>
              </a>
            ))}
          </div>

          {/* Phone only: with no hover, the drag and scroll need a nudge.
              On a desktop the character and tiles speak for themselves. */}
          {compact && (
            <p className="swivel-hint" aria-hidden="true">
              &larr; drag to make me swivel &rarr;
              <span className="swivel-hint__more">
                scroll for parts of my life &darr;
              </span>
            </p>
          )}

          <div className="video-box">
            <CursorScrubVideo
              videoFile={VIDEO_SRC}
              axis="horizontal"
              reverse={false}
              trackingArea="window"
              smoothing={0.22}
              objectFit={compact ? "cover" : "contain"}
              showPoster
              borderRadius={0}
              chromaKey
            />
          </div>
        </div>

        {/* Phone-only: the same six tiles as the hover reveal, laid out
            as something you can actually tap. Hidden above 720px in
            App.css, where the hover reveal takes over. */}
        <section className="tiles" aria-label="Parts of my life">
          <h2 className="tiles__title">Parts of my life</h2>
          <ul className="tiles__grid">
            {REVEAL_ITEMS.map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  className="tile"
                  style={{ "--tilt": item.tilt, ...artStyle(item.art) }}
                  onClick={tileClick(item.href)}
                >
                  <span className="tile__art">
                    <img src={item.img} alt="" draggable="false" />
                  </span>
                  <span className="tile__label">{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>

      {/* Phone-only. Outside <main> so the zoom transform on the stage
          cannot capture its fixed positioning. */}
      {showMenu && (
        <div
          id="site-menu"
          className="menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <ul className="menu__list">
            {REVEAL_ITEMS.map((item, i) => (
              <li key={item.label} style={{ "--i": i }}>
                <a
                  href={item.href}
                  className="menu__item"
                  style={{ "--tilt": item.tilt, ...artStyle(item.art) }}
                  onClick={tileClick(item.href)}
                >
                  <span className="menu__art" aria-hidden="true">
                    <img src={item.img} alt="" draggable="false" />
                  </span>
                  <span className="menu__label">{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
          <div className="menu__foot" style={{ "--i": REVEAL_ITEMS.length }}>
            <a href="#about" onClick={() => setMenuOpen(false)}>
              About
            </a>
            <a href="#contact" onClick={() => setMenuOpen(false)}>
              Contact
            </a>
          </div>
        </div>
      )}

      {/* runId restarts the entrance animation on a repeat visit; the
          zoom origin is inherited from the tile that was clicked. */}
      {phase !== "home" && view === "journal" && (
        <Journal
          key={runId}
          onClose={close}
          closing={phase === "closing"}
          style={{ "--zx": `${origin.x}%`, "--zy": `${origin.y}%` }}
        />
      )}
      {phase !== "home" && view === "travels" && (
        <Suspense fallback={null}>
          <Travels
            key={runId}
            onClose={close}
            closing={phase === "closing"}
            style={{ "--zx": `${origin.x}%`, "--zy": `${origin.y}%` }}
          />
        </Suspense>
      )}
      {phase !== "home" && view === "daily-report" && (
        <DailyReport
          key={runId}
          onClose={close}
          closing={phase === "closing"}
          style={{ "--zx": `${origin.x}%`, "--zy": `${origin.y}%` }}
        />
      )}
      {phase !== "home" && view === "finances" && (
        <Finances
          key={runId}
          onClose={close}
          closing={phase === "closing"}
          style={{ "--zx": `${origin.x}%`, "--zy": `${origin.y}%` }}
        />
      )}
      {phase !== "home" && view === "cooking" && (
        <Cookbook
          key={runId}
          onClose={close}
          closing={phase === "closing"}
          style={{ "--zx": `${origin.x}%`, "--zy": `${origin.y}%` }}
        />
      )}
    </>
  );
}
