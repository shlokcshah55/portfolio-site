import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const JOURNAL_DIR = fileURLToPath(new URL('src/data/journal', import.meta.url))
const ENTRIES = path.join(JOURNAL_DIR, 'entries.json')
const LOCKED = path.join(JOURNAL_DIR, 'locked.json')

/* Serves the journal as `virtual:journal`, with every entry that has a
   record in locked.json replaced by its ciphertext. The Notion sync
   writes plain text for every entry into entries.json each week, so
   the swap happens here rather than trusting the file: a locked entry's
   words never reach the bundle whatever the JSON says. See
   scripts/journal-lock.mjs for the other half. */
function journalLock() {
  const id = 'virtual:journal'
  const resolved = '\0' + id
  return {
    name: 'journal-lock',
    resolveId(source) {
      return source === id ? resolved : null
    },
    load(source) {
      if (source !== resolved) return null
      this.addWatchFile(ENTRIES)
      this.addWatchFile(LOCKED)

      const journal = JSON.parse(readFileSync(ENTRIES, 'utf8'))
      const locked = existsSync(LOCKED)
        ? JSON.parse(readFileSync(LOCKED, 'utf8'))
        : { entries: {} }

      journal.entries = journal.entries.map((entry) => {
        const rec = locked.entries[entry.id]
        if (!rec) return entry
        if (entry.notion_edited !== rec.notion_edited) {
          this.warn(
            `journal entry "${entry.id}" was edited in Notion after it was ` +
              `locked; the site shows the locked version. Run ` +
              `npm run journal:lock to update it.`,
          )
        }
        const { blurb, body, ...rest } = entry
        void blurb
        void body
        return { ...rest, locked: { iv: rec.iv, data: rec.data } }
      })

      if (Object.keys(locked.entries).length) {
        journal.lock = {
          salt: locked.salt,
          iterations: locked.kdf.iterations,
        }
      }

      return `export default ${JSON.stringify(journal)};`
    },
    handleHotUpdate({ file, server }) {
      if (file !== ENTRIES && file !== LOCKED) return
      const mod = server.moduleGraph.getModuleById(resolved)
      if (mod) server.moduleGraph.invalidateModule(mod)
      server.ws.send({ type: 'full-reload' })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), journalLock()],
})
