import { useEffect, useState } from "react";
import "./Film.css";

/* Clips play in rotation on the camcorder's flip-out LCD, advancing to
   the next one whenever the current one ends. */
const CLIPS = ["/video1.mov", "/video2.mov"];

/* The screen's rect within camera.jpeg (1407x768), as a fraction of
   the image — measured from the photo's actual white panel, not
   eyeballed, so the video sits flush against the bezel at any size. */
const SCREEN = {
  left: 0.5039,
  top: 0.306,
  width: 0.3319,
  height: 0.4141,
};

export default function Film({ onClose, closing, style }) {
  const [clipIndex, setClipIndex] = useState(0);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={`film-view ${closing ? "is-closing" : ""}`} style={style}>
      <button type="button" className="film-back" onClick={onClose}>
        <span aria-hidden="true">&larr;</span> Back
      </button>

      <div className="film-stage">
        <div className="camcorder">
          <img
            className="camcorder__body"
            src="/camera.jpeg"
            alt="A Fuji HS-V70 camcorder with its flip-out screen open"
            draggable="false"
          />
          <div
            className="camcorder__screen"
            style={{
              left: `${SCREEN.left * 100}%`,
              top: `${SCREEN.top * 100}%`,
              width: `${SCREEN.width * 100}%`,
              height: `${SCREEN.height * 100}%`,
            }}
          >
            <video
              key={clipIndex}
              className="camcorder__clip"
              src={CLIPS[clipIndex]}
              autoPlay
              muted
              playsInline
              onEnded={() =>
                setClipIndex((index) => (index + 1) % CLIPS.length)
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
