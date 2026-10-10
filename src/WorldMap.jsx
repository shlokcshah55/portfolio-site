import { useMemo } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import worldTopology from "world-atlas/countries-50m.json";
import "./WorldMap.css";

/* The SVG's own coordinate space — everything drawn inside <WorldMap>,
   and every lon/lat a caller wants placed on top of it (rope anchors in
   Travels.jsx), goes through `project()` below to land in this box. */
export const MAP_VIEW_W = 960;
export const MAP_VIEW_H = 500;

/* Callers lay ropes and photos out in a larger "stage" than the map
   itself, so decorative elements have room to sit well clear of the
   coastline instead of crowding it. MAP_OFFSET_* is how far the map is
   inset from the stage's top-left corner — <WorldMap> positions its own
   <svg> by these, and Travels.jsx adds them to every projected point it
   places outside the map (rope anchors, the pin dot), so both agree on
   one coordinate system. */
export const STAGE_W = 1150;
export const STAGE_H = 740;
export const MAP_OFFSET_X = (STAGE_W - MAP_VIEW_W) / 2;
export const MAP_OFFSET_Y = (STAGE_H - MAP_VIEW_H) / 2;

const countries = feature(worldTopology, worldTopology.objects.countries);

const projection = geoNaturalEarth1().fitSize([MAP_VIEW_W, MAP_VIEW_H], countries);
const pathGenerator = geoPath(projection);

/* Real lon/lat -> the exact SVG coordinates the map itself is drawn in,
   so a rope anchored to, say, Madrid lines up with the country shape
   without any hand-calibrated guessing. */
export function project([lon, lat]) {
  const [x, y] = projection([lon, lat]);
  return { x, y };
}

const COUNTRIES = countries.features.map((f) => ({
  feature: f,
  d: pathGenerator(f),
  name: f.properties.name,
}));

export default function WorldMap({ highlight, hoveredName, onHoverCountry, onClickCountry }) {
  /* CSS transforms don't reorder SVG paint order, so a lifted country
     can still be clipped by a neighbour drawn after it. Rendering the
     hovered one last keeps it on top while it's raised. */
  const ordered = useMemo(() => {
    if (!hoveredName) return COUNTRIES;
    const rest = COUNTRIES.filter((c) => c.name !== hoveredName);
    const hovered = COUNTRIES.find((c) => c.name === hoveredName);
    return hovered ? [...rest, hovered] : COUNTRIES;
  }, [hoveredName]);

  return (
    <svg
      className="world-map"
      viewBox={`0 0 ${MAP_VIEW_W} ${MAP_VIEW_H}`}
      role="img"
      aria-label="World map with places I've traveled highlighted"
      style={{
        left: `${(MAP_OFFSET_X / STAGE_W) * 100}%`,
        top: `${(MAP_OFFSET_Y / STAGE_H) * 100}%`,
        width: `${(MAP_VIEW_W / STAGE_W) * 100}%`,
        height: `${(MAP_VIEW_H / STAGE_H) * 100}%`,
      }}
    >
      {ordered.map(({ feature: f, d, name }) => {
        const tier = highlight.get(name);
        return (
          <path
            key={f.id ?? name}
            d={d}
            className={`country ${tier ? `country--${tier}` : ""} ${
              name === hoveredName ? "is-hovered" : ""
            }`}
            onMouseEnter={() => onHoverCountry(name)}
            onMouseLeave={() => onHoverCountry(null)}
            onClick={tier === "featured" ? () => onClickCountry(name) : undefined}
          >
            <title>{name}</title>
          </path>
        );
      })}
    </svg>
  );
}
