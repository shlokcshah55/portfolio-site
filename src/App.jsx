import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import CursorScrubVideo from "./CursorScrubVideo";
import Journal from "./Journal";
import DailyReport from "./DailyReport";
import Finances from "./Finances";
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
   alpha bounds, in units of the rendered image width. */
const REVEAL_ITEMS = [
  {
    side: "left",
    img: "/newspaper.png",
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
    label: "Cooking",
    href: "#cooking",
    top: "50%",
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
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const [runId, setRunId] = useState(0);

  const open = useCallback((element, viewId) => {
    const rect = element.getBoundingClientRect();
    setOrigin({
      x: ((rect.left + rect.width / 2) / window.innerWidth) * 100,
      y: ((rect.top + rect.height / 2) / window.innerHeight) * 100,
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

  const stageState =
    phase === "opening"
      ? "is-leaving"
      : phase === "open"
        ? "is-away"
        : phase === "closing"
          ? "is-returning"
          : "";

  return (
    <>
      <main
        className={`stage ${stageState}`}
        style={{ "--zx": `${origin.x}%`, "--zy": `${origin.y}%` }}
        aria-hidden={phase === "open"}
      >
        <h1 className="sr-only">Shlok Shah</h1>

        <nav className="site-nav">
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

        <div className="info-block">
          <svg
            className="info-icon"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M12 2l2.2 6.8H21l-5.6 4.1 2.2 6.8-5.6-4.2-5.6 4.2 2.2-6.8L3 8.8h6.8z"
              fill="currentColor"
            />
          </svg>
          <p>
            I build clean, thoughtful products and interfaces &mdash; always
            shipping, always iterating.
          </p>
          <a className="pill-btn" href="#work">
            See My Work
          </a>
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
              onClick={
                ZOOM_VIEWS[item.href]
                  ? (event) => {
                      event.preventDefault();
                      open(event.currentTarget, ZOOM_VIEWS[item.href]);
                    }
                  : undefined
              }
            >
              <img src={item.img} alt="" draggable="false" />
              <span className="reveal-label">{item.label}</span>
            </a>
          ))}
        </div>

        <p className="swivel-hint" aria-hidden="true">
          &larr; move your mouse to make me swivel and see parts of my life &rarr;
        </p>

        <div className="video-box">
          <CursorScrubVideo
            videoFile={VIDEO_SRC}
            axis="horizontal"
            reverse={false}
            trackingArea="window"
            smoothing={0.22}
            objectFit="contain"
            showPoster
            borderRadius={0}
            chromaKey
          />
        </div>
      </main>

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
    </>
  );
}
