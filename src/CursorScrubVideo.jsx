import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Frame-accurate note:
 * For frame-accurate scrubbing, encode all-iframe video. Recommended command:
 * ffmpeg -i in.mp4 -c:v libx264 -preset slow -crf 18 -g 1 -keyint_min 1 -x264-params "scenecut=0" -profile:v high -pix_fmt yuv420p -movflags +faststart -an out.mp4
 */
export default function CursorScrubVideo({
  videoFile,
  axis = "horizontal",
  reverse = false,
  trackingArea = "component",
  smoothing = 0.22,
  objectFit = "cover",
  showPoster = true,
  borderRadius = 0,
  style,
  // When true, renders the video onto a canvas and cuts the studio
  // backdrop to transparent each frame, so the subject becomes a true
  // alpha cutout you can stack over other layers. The backdrop color
  // is sampled from the frame borders each frame (any solid backdrop
  // works), and background pixels are found by flood-filling
  // backdrop-colored pixels inward from the borders — so
  // backdrop-colored details inside the subject survive while the
  // backdrop and its edge halos are removed.
  chromaKey = false,
}) {
  const rootRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const workCanvasRef = useRef(null);
  const keyBuffersRef = useRef(null);
  const rafRef = useRef(null);
  const readyRef = useRef(false);
  const seekingFreeRef = useRef(true);
  const targetNormRef = useRef(0);
  const currentNormRef = useRef(0);
  const [isReady, setIsReady] = useState(false);

  const clamp01 = useCallback((value) => {
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
  }, []);

  const drawFrame = useCallback(() => {
    if (!chromaKey) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!video || !canvas || !root) return;
    if (!video.videoWidth || !video.videoHeight) return;

    // --- 1. Grab the frame at (capped) source resolution. Keying at
    // source resolution keeps thresholds independent of screen size
    // and is far cheaper than keying a fullscreen hi-dpi canvas.
    const MAX_KEY_PIXELS = 1100000;
    const videoW = video.videoWidth;
    const videoH = video.videoHeight;
    const keyScale = Math.min(1, Math.sqrt(MAX_KEY_PIXELS / (videoW * videoH)));
    const w = Math.max(Math.round(videoW * keyScale), 2);
    const h = Math.max(Math.round(videoH * keyScale), 2);

    if (!workCanvasRef.current) {
      workCanvasRef.current = document.createElement("canvas");
    }
    const work = workCanvasRef.current;
    if (work.width !== w || work.height !== h) {
      work.width = w;
      work.height = h;
      keyBuffersRef.current = null;
    }
    const wctx = work.getContext("2d", { willReadFrequently: true });
    if (!wctx) return;
    wctx.drawImage(video, 0, 0, w, h);

    const frame = wctx.getImageData(0, 0, w, h);
    const data = frame.data;
    const n = w * h;

    if (!keyBuffersRef.current) {
      keyBuffersRef.current = {
        flags: new Uint8Array(n), // bit0 bg-like, bit1 relaxed, bit2 keyed bg
        stack: new Int32Array(n),
        alpha: new Uint8Array(n),
        alphaTmp: new Uint8Array(n),
        hist: new Uint32Array(768),
      };
    }
    const { flags, stack, alpha, alphaTmp, hist } = keyBuffersRef.current;

    // --- 2a. Estimate the backdrop color as the per-channel median
    // of the border pixels: top row plus left and right columns. The
    // bottom border is excluded because the subject may be cropped by
    // the bottom of the frame.
    hist.fill(0);
    let borderCount = 0;
    const sampleBorder = (p) => {
      hist[data[p]]++;
      hist[256 + data[p + 1]]++;
      hist[512 + data[p + 2]]++;
      borderCount++;
    };
    for (let x = 0; x < w; x++) sampleBorder(x * 4);
    for (let y = 1; y < h; y++) {
      sampleBorder(y * w * 4);
      sampleBorder((y * w + w - 1) * 4);
    }
    const half = borderCount / 2;
    const bgc = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      let acc = 0;
      for (let v = 0; v < 256; v++) {
        acc += hist[c * 256 + v];
        if (acc >= half) {
          bgc[c] = v;
          break;
        }
      }
    }
    const bgR = bgc[0];
    const bgG = bgc[1];
    const bgB = bgc[2];

    // --- 2b. Classify pixels by color distance to the backdrop.
    // Only connectivity to the frame border (step 3) decides what is
    // actually background — a value-only rule would also key
    // backdrop-colored details inside the subject.
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      const dr = data[p] - bgR;
      const dg = data[p + 1] - bgG;
      const db = data[p + 2] - bgB;
      const dist =
        (dr < 0 ? -dr : dr) + (dg < 0 ? -dg : dg) + (db < 0 ? -db : db);
      let f = 0;
      if (dist < 40) f |= 1;
      if (dist < 90) f |= 2;
      flags[i] = f;
    }

    // --- 3. Flood-fill background from the frame borders through
    // bg-like pixels, so neutral bright details inside the subject
    // are never keyed.
    let sp = 0;
    for (let x = 0; x < w; x++) {
      const top = x;
      const bottom = n - w + x;
      if (flags[top] & 1) {
        flags[top] |= 4;
        stack[sp++] = top;
      }
      if (flags[bottom] & 1 && !(flags[bottom] & 4)) {
        flags[bottom] |= 4;
        stack[sp++] = bottom;
      }
    }
    for (let y = 0; y < h; y++) {
      const left = y * w;
      const right = left + w - 1;
      if (flags[left] & 1 && !(flags[left] & 4)) {
        flags[left] |= 4;
        stack[sp++] = left;
      }
      if (flags[right] & 1 && !(flags[right] & 4)) {
        flags[right] |= 4;
        stack[sp++] = right;
      }
    }
    while (sp > 0) {
      const i = stack[--sp];
      const x = i % w;
      const up = i - w;
      const down = i + w;
      if (x > 0 && (flags[i - 1] & 5) === 1) {
        flags[i - 1] |= 4;
        stack[sp++] = i - 1;
      }
      if (x < w - 1 && (flags[i + 1] & 5) === 1) {
        flags[i + 1] |= 4;
        stack[sp++] = i + 1;
      }
      if (up >= 0 && (flags[up] & 5) === 1) {
        flags[up] |= 4;
        stack[sp++] = up;
      }
      if (down < n && (flags[down] & 5) === 1) {
        flags[down] |= 4;
        stack[sp++] = down;
      }
    }

    // --- 4. Grow the keyed region a few pixels into "relaxed"
    // pixels: the thin halo where backdrop blends into the subject
    // edge is slightly saturated and would otherwise survive as
    // fringe.
    for (let pass = 0; pass < 4; pass++) {
      let fp = 0;
      for (let i = 0; i < n; i++) {
        if ((flags[i] & 6) !== 2) continue; // relaxed but not yet bg
        const x = i % w;
        if (
          (x > 0 && flags[i - 1] & 4) ||
          (x < w - 1 && flags[i + 1] & 4) ||
          (i >= w && flags[i - w] & 4) ||
          (i < n - w && flags[i + w] & 4)
        ) {
          stack[fp++] = i;
        }
      }
      for (let j = 0; j < fp; j++) flags[stack[j]] |= 4;
      if (fp === 0) break;
    }

    // --- 5. Binary alpha from the keyed mask, feathered with a small
    // separable box blur for smooth edges.
    for (let i = 0; i < n; i++) {
      alpha[i] = flags[i] & 4 ? 0 : 255;
    }
    for (let y = 0; y < h; y++) {
      const row = y * w;
      alphaTmp[row] = (alpha[row] * 2 + alpha[row + 1]) / 3;
      for (let x = 1; x < w - 1; x++) {
        const i = row + x;
        alphaTmp[i] = (alpha[i - 1] + alpha[i] + alpha[i + 1]) / 3;
      }
      const end = row + w - 1;
      alphaTmp[end] = (alpha[end - 1] + alpha[end] * 2) / 3;
    }
    for (let x = 0; x < w; x++) {
      alpha[x] = (alphaTmp[x] * 2 + alphaTmp[x + w]) / 3;
      for (let y = 1; y < h - 1; y++) {
        const i = y * w + x;
        alpha[i] = (alphaTmp[i - w] + alphaTmp[i] + alphaTmp[i + w]) / 3;
      }
      const end = (h - 1) * w + x;
      alpha[end] = (alphaTmp[end - w] + alphaTmp[end] * 2) / 3;
    }

    // --- 6. Un-mix the backdrop out of semi-transparent edge pixels
    // (they are a blend of subject and backdrop) so edges carry no
    // backdrop-colored fringe when composited over any page color.
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      const a255 = alpha[i];
      if (a255 < 5) {
        data[p + 3] = 0;
        continue;
      }
      if (a255 < 255) {
        const a = a255 / 255;
        const inv = 1 - a;
        for (let c = 0; c < 3; c++) {
          const v = (data[p + c] - bgc[c] * inv) / a;
          data[p + c] = v < 0 ? 0 : v > 255 ? 255 : v;
        }
      }
      data[p + 3] = a255;
    }
    wctx.putImageData(frame, 0, 0);

    // --- 7. Draw the keyed frame onto the display canvas with
    // object-fit semantics.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = root.getBoundingClientRect();
    const pixelWidth = Math.round(Math.max(rect.width, 1) * dpr);
    const pixelHeight = Math.round(Math.max(rect.height, 1) * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const srcRatio = w / h;
    const boxRatio = pixelWidth / pixelHeight;
    ctx.clearRect(0, 0, pixelWidth, pixelHeight);

    if (objectFit === "contain") {
      let dw = pixelWidth;
      let dh = pixelWidth / srcRatio;
      if (dh > pixelHeight) {
        dh = pixelHeight;
        dw = pixelHeight * srcRatio;
      }
      ctx.drawImage(work, (pixelWidth - dw) / 2, (pixelHeight - dh) / 2, dw, dh);
    } else {
      let sx = 0;
      let sy = 0;
      let sw = w;
      let sh = h;
      if (srcRatio > boxRatio) {
        sw = h * boxRatio;
        sx = (w - sw) / 2;
      } else {
        sh = w / boxRatio;
        sy = (h - sh) / 2;
      }
      ctx.drawImage(work, sx, sy, sw, sh, 0, 0, pixelWidth, pixelHeight);
    }
  }, [chromaKey, objectFit]);

  const updateTargetFromClientPoint = useCallback(
    (clientX, clientY) => {
      if (!videoFile) return;
      let normalized = 0;
      if (trackingArea === "window") {
        if (typeof window === "undefined") return;
        const width = Math.max(window.innerWidth, 1);
        const height = Math.max(window.innerHeight, 1);
        normalized = axis === "horizontal" ? clientX / width : clientY / height;
      } else {
        const root = rootRef.current;
        if (!root) return;
        const rect = root.getBoundingClientRect();
        const width = Math.max(rect.width, 1);
        const height = Math.max(rect.height, 1);
        normalized =
          axis === "horizontal"
            ? (clientX - rect.left) / width
            : (clientY - rect.top) / height;
      }
      normalized = clamp01(normalized);
      if (reverse) normalized = 1 - normalized;
      targetNormRef.current = normalized;
    },
    [axis, clamp01, reverse, trackingArea, videoFile]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoFile) return;

    readyRef.current = false;
    seekingFreeRef.current = true;
    targetNormRef.current = 0;
    currentNormRef.current = 0;
    setIsReady(false);

    const onCanPlayThrough = () => {
      readyRef.current = true;
      setIsReady(true);
      drawFrame();
    };
    const onSeeking = () => {
      seekingFreeRef.current = false;
    };
    const onSeeked = () => {
      seekingFreeRef.current = true;
      drawFrame();
    };
    const onLoadedMetadata = () => {
      try {
        video.currentTime = 0;
      } catch (_error) {}
    };

    video.addEventListener("canplaythrough", onCanPlayThrough);
    video.addEventListener("seeking", onSeeking);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("loadedmetadata", onLoadedMetadata);

    try {
      video.load();
      video
        .play()
        .then(() => {
          video.pause();
        })
        .catch(() => {});
      video.currentTime = 0;
    } catch (_error) {}

    return () => {
      video.removeEventListener("canplaythrough", onCanPlayThrough);
      video.removeEventListener("seeking", onSeeking);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
    };
  }, [videoFile, drawFrame]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!videoFile) return;
    if (trackingArea !== "window") return;

    const onPointerMove = (event) => {
      updateTargetFromClientPoint(event.clientX, event.clientY);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [trackingArea, updateTargetFromClientPoint, videoFile]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!videoFile) return;

    const tick = () => {
      const video = videoRef.current;
      if (!video) {
        rafRef.current = window.requestAnimationFrame(tick);
        return;
      }

      if (!readyRef.current) {
        if (video.currentTime !== 0) {
          try {
            video.currentTime = 0;
          } catch (_error) {}
        }
        rafRef.current = window.requestAnimationFrame(tick);
        return;
      }

      const lerpFactor = clamp01(smoothing);
      currentNormRef.current +=
        (targetNormRef.current - currentNormRef.current) * lerpFactor;

      const duration = video.duration;
      if (Number.isFinite(duration) && duration > 0 && seekingFreeRef.current) {
        const targetTime = currentNormRef.current * duration;
        const delta = Math.abs(targetTime - video.currentTime);
        if (delta > 0.008) {
          seekingFreeRef.current = false;
          try {
            video.currentTime = targetTime;
          } catch (_error) {
            seekingFreeRef.current = true;
          }
        }
      }

      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [clamp01, smoothing, videoFile]);

  useEffect(() => {
    if (!chromaKey) return;
    if (typeof ResizeObserver === "undefined") return;
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(() => drawFrame());
    observer.observe(root);
    return () => observer.disconnect();
  }, [chromaKey, drawFrame]);

  const onRootPointerMove = useCallback(
    (event) => {
      if (trackingArea !== "component") return;
      updateTargetFromClientPoint(event.clientX, event.clientY);
    },
    [trackingArea, updateTargetFromClientPoint]
  );

  const placeholderText = !videoFile ? "Add a video file" : "Loading video…";

  return (
    <div
      ref={rootRef}
      onPointerMove={onRootPointerMove}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        borderRadius: `${borderRadius}px`,
        background: chromaKey ? "transparent" : "#FFFFFF",
        ...style,
      }}
    >
      {videoFile ? (
        <video
          ref={videoRef}
          src={videoFile}
          muted
          playsInline
          preload="auto"
          disableRemotePlayback
          controls={false}
          style={
            chromaKey
              ? {
                  position: "absolute",
                  width: 1,
                  height: 1,
                  opacity: 0,
                  pointerEvents: "none",
                }
              : {
                  width: "100%",
                  height: "100%",
                  objectFit,
                  borderRadius: `${borderRadius}px`,
                  display: "block",
                }
          }
          poster={showPoster ? undefined : ""}
        />
      ) : null}

      {videoFile && chromaKey ? (
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
          }}
        />
      ) : null}

      {!videoFile || !isReady ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: chromaKey ? "rgba(255,255,255,0.5)" : "#000000",
            background: chromaKey
              ? "transparent"
              : videoFile
                ? "rgba(255,255,255,0.15)"
                : "#F5F5F5",
            fontSize: 14,
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
            pointerEvents: "none",
          }}
        >
          {placeholderText}
        </div>
      ) : null}
    </div>
  );
}
