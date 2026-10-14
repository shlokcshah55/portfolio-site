#!/usr/bin/env node
// Password-protects journal entries.
//
//   node scripts/journal-lock.mjs lock   [--password <pw>] [id ...]
//   node scripts/journal-lock.mjs unlock [--password <pw>] [id ...]
//   node scripts/journal-lock.mjs status
//
// `lock` encrypts the blurb and body of every entry in entries.json that
// still has plain text (or just the ids given), writes the ciphertext to
// locked.json, and strips the plain text from entries.json. `unlock` is
// the reverse. The password can also come from JOURNAL_PASSWORD, or will
// be prompted for.
//
// The weekly Notion sync rewrites entries.json with plain text for every
// entry. That is fine for the site: the Vite plugin in vite.config.js
// swaps any entry that has a record in locked.json for its ciphertext at
// build time, so the plain text never reaches the bundle. Re-run `lock`
// after a sync to strip it from the repo again, and to lock new entries.
//
// Crypto: PBKDF2-SHA256 (one salt per file) -> AES-256-GCM, one IV per
// entry. The browser decrypts with the same WebCrypto calls.

import { webcrypto as crypto } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(here, "..", "src", "data", "journal");
const ENTRIES = path.join(DATA, "entries.json");
const LOCKED = path.join(DATA, "locked.json");

const ITERATIONS = 310_000;

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (bytes) => Buffer.from(bytes).toString("base64");
const unb64 = (s) => new Uint8Array(Buffer.from(s, "base64"));

const readJson = (file, fallback) =>
  existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : fallback;
const writeJson = (file, data) =>
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);

async function deriveKey(password, salt) {
  const material = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encrypt(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(text),
  );
  return { iv: b64(iv), data: b64(data) };
}

async function decrypt(key, { iv, data }) {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(iv) },
    key,
    unb64(data),
  );
  return dec.decode(plain);
}

function parseArgs(argv) {
  const [command = "status", ...rest] = argv;
  let password = process.env.JOURNAL_PASSWORD ?? null;
  const ids = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--password") password = rest[++i];
    else ids.push(rest[i]);
  }
  return { command, password, ids };
}

async function askPassword() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question("Journal password: ");
  rl.close();
  return answer;
}

async function main() {
  const { command, ids, password: given } = parseArgs(process.argv.slice(2));
  const journal = readJson(ENTRIES, null);
  if (!journal) throw new Error(`missing ${ENTRIES}`);
  const locked = readJson(LOCKED, {
    version: 1,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations: ITERATIONS },
    cipher: "AES-GCM",
    salt: null,
    entries: {},
  });

  const wanted = (entry) => ids.length === 0 || ids.includes(entry.id);

  if (command === "status") {
    for (const entry of journal.entries) {
      const rec = locked.entries[entry.id];
      const state = !rec
        ? "open"
        : entry.body
          ? "locked (plain text present in entries.json — run lock)"
          : rec.notion_edited === entry.notion_edited
            ? "locked"
            : "locked (stale: edited in Notion since — run lock)";
      console.log(`${entry.id.padEnd(40)} ${state}`);
    }
    return;
  }

  if (command !== "lock" && command !== "unlock") {
    throw new Error(`unknown command "${command}"`);
  }

  const password = given || (await askPassword());
  if (!password) throw new Error("a password is required");

  if (!locked.salt) locked.salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  const key = await deriveKey(password, unb64(locked.salt));

  // Any existing record proves whether this is the same password as
  // before; a file can only ever hold one.
  const existing = Object.values(locked.entries)[0];
  if (existing) {
    try {
      await decrypt(key, existing);
    } catch {
      throw new Error(
        "that password does not open the entries already in locked.json",
      );
    }
  }

  let changed = 0;

  if (command === "lock") {
    for (const entry of journal.entries) {
      if (!wanted(entry)) continue;
      const rec = locked.entries[entry.id];
      const hasText = entry.body !== undefined || entry.blurb !== undefined;
      if (!hasText) {
        if (!rec) console.warn(`skip ${entry.id}: no text and no record`);
        continue;
      }
      if (rec && rec.notion_edited === entry.notion_edited) {
        // Already locked at this version; just strip the plain text.
      } else {
        const text = JSON.stringify({
          blurb: entry.blurb ?? "",
          body: entry.body ?? [],
        });
        locked.entries[entry.id] = {
          notion_id: entry.notion_id,
          notion_edited: entry.notion_edited,
          ...(await encrypt(key, text)),
        };
      }
      delete entry.blurb;
      delete entry.body;
      entry.locked = true;
      changed++;
      console.log(`locked ${entry.id}`);
    }
  } else {
    for (const entry of journal.entries) {
      if (!wanted(entry)) continue;
      const rec = locked.entries[entry.id];
      if (!rec) continue;
      if (entry.body === undefined) {
        const text = JSON.parse(await decrypt(key, rec));
        entry.blurb = text.blurb;
        entry.body = text.body;
      }
      delete entry.locked;
      delete locked.entries[entry.id];
      changed++;
      console.log(`unlocked ${entry.id}`);
    }
    if (Object.keys(locked.entries).length === 0) locked.salt = null;
  }

  writeJson(ENTRIES, journal);
  writeJson(LOCKED, locked);
  console.log(`${changed} ${changed === 1 ? "entry" : "entries"} ${command}ed`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
