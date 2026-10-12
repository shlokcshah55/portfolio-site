import { useCallback, useEffect, useRef, useState } from "react";
import { RECIPES } from "./data/recipes";
import useMediaQuery, { COMPACT_QUERY } from "./useMediaQuery";
import "./Cookbook.css";

/* Kept in sync with --turn in Cookbook.css: a turn is committed once
   the leaf animation has finished (onAnimationEnd), with this timeout
   as a fallback for the reduced-motion case where no animation runs. */
const TURN_MS = 900;

/* Horizontal drag past this many pixels reads as a page flick. */
const SWIPE_PX = 40;

/* The photo, pasted in like a print. */
function Print({ recipe }) {
  return (
    <figure className="cb-print">
      {recipe.image ? (
        <img src={recipe.image} alt={recipe.title} draggable="false" />
      ) : (
        <div className="cb-print__placeholder" aria-hidden="true">
          <span>{recipe.title.charAt(0)}</span>
        </div>
      )}
      <figcaption className="cb-print__caption">
        <span>{recipe.title}</span>
        <span>{recipe.date}</span>
      </figcaption>
    </figure>
  );
}

/* The written part: the occasion, then ingredients, then the method. */
function RecipeBody({ recipe }) {
  return (
    <div className="cb-recipe">
      <h2 className="cb-recipe__title">{recipe.title}</h2>
      <p className="cb-recipe__meta">
        <span>{recipe.date}</span>
        <span>{recipe.time}</span>
        <span>Serves {recipe.serves}</span>
      </p>
      {recipe.occasion && <p className="cb-recipe__occasion">{recipe.occasion}</p>}

      <h3 className="cb-recipe__heading">Ingredients</h3>
      <ul className="cb-recipe__ingredients">
        {recipe.ingredients.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h3 className="cb-recipe__heading">Method</h3>
      <ol className="cb-recipe__steps">
        {recipe.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </div>
  );
}

/* Left-hand page of the spread. */
function PhotoPage({ recipe }) {
  return (
    <div className="cb-page cb-page--photo">
      <Print recipe={recipe} />
    </div>
  );
}

/* Right-hand page of the spread. */
function RecipePage({ recipe }) {
  return (
    <div className="cb-page cb-page--recipe">
      <RecipeBody recipe={recipe} />
    </div>
  );
}

/* A phone has no spread, so both halves stack on one scrolling sheet. */
function SheetPage({ recipe }) {
  return (
    <div className="cb-page cb-page--sheet">
      <Print recipe={recipe} />
      <RecipeBody recipe={recipe} />
    </div>
  );
}

export default function Cookbook({ onClose, closing, style }) {
  const [index, setIndex] = useState(0);
  /* { dir: "next" | "prev", to } while a leaf is mid-turn. */
  const [turn, setTurn] = useState(null);
  /* Direction of the last move on a phone, for the slide animation. */
  const [slide, setSlide] = useState(null);
  const dragStart = useRef(null);
  const count = RECIPES.length;
  /* A phone shows one sheet at a time rather than the open spread, so
     there is no leaf to turn: the sheet just slides to the next one. */
  const compact = useMediaQuery(COMPACT_QUERY);

  const go = useCallback(
    (dir) => {
      if (turn) return;
      const to = index + (dir === "next" ? 1 : -1);
      if (to < 0 || to >= count) return;
      if (compact) {
        setSlide(dir);
        setIndex(to);
        return;
      }
      setTurn({ dir, to });
    },
    [turn, index, count, compact],
  );

  const commit = useCallback(() => {
    setTurn((current) => {
      if (current) setIndex(current.to);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!turn) return undefined;
    const id = setTimeout(commit, TURN_MS + 50);
    return () => clearTimeout(id);
  }, [turn, commit]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight") go("next");
      else if (event.key === "ArrowLeft") go("prev");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, go]);

  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    dragStart.current = event.clientX;
  };

  const onPointerUp = (event) => {
    const start = dragStart.current;
    dragStart.current = null;
    if (start == null) return;
    const dx = event.clientX - start;
    /* Dragging a page leftwards pulls the next one over, like paper. */
    if (dx <= -SWIPE_PX) go("next");
    else if (dx >= SWIPE_PX) go("prev");
  };

  /* The page a leaf lifts off must already show where we are going,
     while the page it lands on keeps the old content until covered.
     Turning forward lifts the right page; turning back lifts the left. */
  const leftResting = turn?.dir === "prev" ? RECIPES[turn.to] : RECIPES[index];
  const rightResting =
    turn?.dir === "next" ? RECIPES[turn.to] : RECIPES[index];

  const hasPrev = index > 0 && !turn;
  const hasNext = index < count - 1 && !turn;

  return (
    <div
      className={`cookbook-view ${closing ? "is-closing" : ""}`}
      style={style}
    >
      <button type="button" className="cookbook-back" onClick={onClose}>
        <span aria-hidden="true">&larr;</span> Back
      </button>

      <header className="cookbook-head">
        <h1 className="cookbook-title">Cookbook</h1>
        <p className="cookbook-sub">Things I cooked and wrote down.</p>
      </header>

      <div className="cookbook-stage">
        <button
          type="button"
          className="cb-turn cb-turn--prev"
          onClick={() => go("prev")}
          disabled={!hasPrev}
          aria-label="Previous recipe"
        >
          &larr;
        </button>

        <div
          className="cb-book-frame"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (dragStart.current = null)}
        >
          <div className="cb-book">
            <img
              className="cb-book__art"
              src="/cookbook.png"
              alt=""
              draggable="false"
            />

            {/* Keyed so a phone's slide animation restarts per recipe;
                on a desktop the leaf covers this slot while it swaps. */}
            <div
              key={leftResting.id}
              className="cb-page-slot cb-page-slot--left"
              data-slide={compact ? slide : undefined}
            >
              {compact ? (
                <SheetPage recipe={leftResting} />
              ) : (
                <PhotoPage recipe={leftResting} />
              )}
            </div>
            <div className="cb-page-slot cb-page-slot--right">
              <RecipePage recipe={rightResting} />
            </div>

            {turn && (
              <div
                className={`cb-leaf cb-leaf--${turn.dir}`}
                onAnimationEnd={commit}
                aria-hidden="true"
              >
                <div className="cb-leaf__face cb-leaf__face--front">
                  {turn.dir === "next" ? (
                    <RecipePage recipe={RECIPES[index]} />
                  ) : (
                    <PhotoPage recipe={RECIPES[index]} />
                  )}
                </div>
                <div className="cb-leaf__face cb-leaf__face--back">
                  {turn.dir === "next" ? (
                    <PhotoPage recipe={RECIPES[turn.to]} />
                  ) : (
                    <RecipePage recipe={RECIPES[turn.to]} />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          className="cb-turn cb-turn--next"
          onClick={() => go("next")}
          disabled={!hasNext}
          aria-label="Next recipe"
        >
          &rarr;
        </button>
      </div>

      <p className="cookbook-foot" aria-live="polite">
        <span className="cookbook-count">
          {(turn?.to ?? index) + 1} / {count}
        </span>
        <span className="cookbook-hint">
          {compact ? "swipe to turn the page" : "flick, drag, or use the arrow keys"}
        </span>
      </p>
    </div>
  );
}
