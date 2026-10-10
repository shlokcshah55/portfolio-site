// Tube Brief data, written daily by the 6am automation.
// briefs/YYYY-MM-DD.json — one file per day.
// bank.json            — every concept seen, with my 0-10 familiarity.

import bank from "./bank.json";

const files = import.meta.glob("./briefs/*.json", { eager: true, import: "default" });

// Newest first.
export const briefs = Object.values(files).sort((a, b) => b.date.localeCompare(a.date));

export const latestBrief = briefs[0] ?? null;

export const concepts = bank.concepts;
