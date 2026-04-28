# Saddle as a Vite orchestrator

## Context

Today, getting a design system into Saddle takes too many manual steps for a designer-first tool:

1. Designer runs `npm install` then `npm run dev` themselves in a terminal.
2. Designer manually adds `import './saddle-bridge.js'` to their entry file before Saddle's inspector works.
3. Token edits in Saddle do write to the user's tokens file, but the loop relies on the user's *own* dev server already being up.

The vision is a Storybook-equivalent experience for design system editing: drop a folder, get a working component canvas, edit tokens with real HMR. The key insight (validated by a recent canvas+code editor experiment circulated on Twitter) is that the bundler should be Saddle's responsibility, not the designer's.

This spec replaces the current "Connect to existing dev server" flow as the default with **Saddle-managed Vite** — Saddle owns the dev server lifecycle, injects the bridge automatically, and reads the existing project's `vite.config` so user plugins (Tailwind, Radix, CSS-in-JS) keep working. The current connect-to-existing flow stays as a fallback.

## Approach

Saddle becomes a Vite orchestrator. On project load, it generates a wrapped Vite config in the user's `.saddle/` directory, spawns Vite as a child process via Tauri's shell sidecar, and iframes the resulting localhost URL with the existing per-component hash routing. The bridge is no longer a file the user imports — it's a Vite virtual module that the Saddle plugin auto-injects into the served HTML.

### Defaults

- **`.saddle/` lives inside the user's project**, gitignored automatically (Saddle appends to `.gitignore` if needed). No file copying, no symlinks, easy to inspect when debugging. Worst case the user can `rm -rf .saddle/` and re-load.
- **Vite-only.** If the project's `package.json` doesn't have `vite` in deps, the orchestrator skips and Saddle falls back to today's "Connect to existing dev server" flow.
- **Node required locally.** No bundled Node sidecar in this iteration — Saddle surfaces a clear error with install instructions if `node` isn't on PATH.
- **The user's stories file is required for v1.** Saddle looks for an existing `demo/stories.tsx`, `**/*.stories.tsx`, or `demo/App.tsx` with hash routing. If none is found, the orchestrator skips and falls back to today's "Connect to existing dev server" flow with a one-line nudge to add a stories file. Auto-generating a virtual showcase is deferred to a follow-up.

### Components

**1. Project loader** — extends `src-tauri/src/file_operations.rs`'s `scan_directory` and `src/lib/tauri.ts`'s `loadProject` to also detect:

- Vite in `package.json` (`devDependencies` or `dependencies`)
- The user's `vite.config.{ts,js,mts,mjs,cjs}` (first match wins)
- A stories file (heuristic order: `demo/stories.tsx`, `**/*.stories.tsx`, `demo/App.tsx`)
- The existing tokens file (current `loadTokensFromConfig` already does this)

If Vite isn't found, the loader returns a flag indicating "fallback to manual dev server", and Saddle's UI shows the existing settings flow.

**2. `.saddle/vite.config.mts` (generated)** — a thin wrapper Saddle writes on project load:

```ts
import userConfig from '../vite.config';
import { saddlePlugin } from './saddle-plugin.mjs';

const merged = typeof userConfig === 'function'
  ? async (env) => {
      const c = await userConfig(env);
      return { ...c, plugins: [...(c.plugins ?? []), saddlePlugin()] };
    }
  : { ...userConfig, plugins: [...(userConfig.plugins ?? []), saddlePlugin()] };

export default merged;
```

Handles both static-object and function-form configs. The wrapper imports the user's existing config so Tailwind, aliases, env-var-driven options, etc. continue to work.

**3. `.saddle/saddle-plugin.mjs` (generated)** — the Saddle Vite plugin. Two responsibilities:

- Serve the bridge as a virtual module (`virtual:saddle-bridge`) using `resolveId` + `load` hooks. The bridge source is bundled into the plugin file as a string at write-time (so it ships with Saddle and gets regenerated on version bumps).
- Inject `<script type="module" src="/@id/virtual:saddle-bridge"></script>` into the served HTML via the `transformIndexHtml` hook.

Nothing else: the bridge handles everything else (DOM tree, click inspection, token postMessage, element-state forcing).

**4. Vite child process (Tauri shell sidecar)** — a new Tauri command (`spawn_dev_server`) that:

- Resolves `node_modules/.bin/vite` (or `node node_modules/vite/bin/vite.js` for Windows compatibility) inside the user's project directory
- Spawns it as a child process with the working directory set to the project root and `--config .saddle/vite.config.mts`
- Pipes stdout to a buffered reader, watches for `http://localhost:XXXX/` on a `Local:` line, parses out the URL
- Returns the URL to the frontend
- Stores the child handle so a matching `kill_dev_server` command can stop it on project unload / app exit
- Emits stderr as Tauri events so the frontend can surface "Vite failed to start" with the actual error

The Tauri capabilities config (`src-tauri/capabilities/default.json`) needs `shell:allow-execute` (or equivalent) for the user's Vite binary path. Path is restricted to the project root for safety.

**5. Saddle UI: dev server status** — a small status pill in the Settings view (and optionally a corner badge on the canvas) showing:

- `Spawning Vite…` (during startup)
- `Live · :5173` (with the captured port)
- `Failed: <error>` (with a "Retry" button and a "Switch to manual" escape hatch)

Pill replaces today's manual "paste a URL" input as the primary affordance. Manual input stays accessible via a "Connect to existing dev server" toggle.

**6. Token writer** — unchanged in this iteration. Edits continue to write to the user's existing tokens file (`saddle.config.json` or `tokens.css`), and Vite HMR repaints from the file watcher. Saddle still postMessages tokens to the iframe for sub-frame instant feedback before HMR fires (so designers feel the change immediately while disk + HMR catch up). Per-element overrides remain postMessage-only — they don't write to disk in this iteration (deferred per the brainstorm decision).

**7. Repackaged bridge** — `saddle-bridge.js` becomes the string content shipped inside `saddle-plugin.mjs`. The standalone `saddle-bridge.js` file at the repo root stays for the fallback "Connect to existing dev server" flow (where users still need to import it manually). Single source of truth: a build step (or just a hand-coordinated copy for now) keeps the two in sync.

### Files Saddle generates in the user's project

```
{user-project}/
├── .saddle/
│   ├── vite.config.mts        # wraps user's vite.config
│   └── saddle-plugin.mjs      # the Saddle Vite plugin (bridge inlined as a string)
└── .gitignore                 # appended with `.saddle/` if not already ignored;
                               # created if it doesn't exist
```

All files are **overwritten** on every project load — they're considered Saddle-managed, not user-edited. `rm -rf .saddle/` is always safe; the next project load regenerates. When Saddle's bridge protocol changes (e.g. a new message type), the regenerated `saddle-plugin.mjs` ships the matching bridge automatically.

### Lifecycle

1. **Project load** → loader detects Vite + stories → if found: write `.saddle/`, append to `.gitignore`, spawn Vite, capture URL, iframe it.
2. **Project unload / different project loaded** → kill child process, abandon `.saddle/` (next load regenerates).
3. **Saddle quit** → kill child process via Tauri's app-exit hook.
4. **Vite crashes during a session** → status pill flips to `Failed`, retry button respawns.

### Non-goals (deliberate)

- Per-element overrides writing to disk (postMessage-only stays for now)
- Webpack / Next.js / CRA support (Vite-only)
- Shipping Node sidecar (require local Node; revisit when this lands)
- A code editor pane (the Twitter playground model is a different product surface)
- Generating a full virtual showcase entry from a token-only `saddle.config.json` (v2 — for now we require an existing stories file)

## Critical files to modify

- `src-tauri/src/lib.rs` — register a new `spawn_dev_server` and `kill_dev_server` Tauri command
- `src-tauri/src/file_operations.rs` — extend `scan_directory` to also detect Vite + stories
- `src-tauri/capabilities/default.json` — add shell-execute permission scoped to the project root
- `src/lib/tauri.ts` — add `spawnDevServer` / `killDevServer` wrappers and a `detectViteSetup` helper
- `src/views/GalleryView.tsx` — call `spawnDevServer` after project load (when Vite detected); pass the captured URL into `setDevServerUrl`
- `src/views/DashboardView.tsx` — surface the dev server status pill, retry/manual-switch UI; demote the URL paste field
- `src/components/ComponentPreview.tsx` — already iframes `devServerUrl`; no change needed
- `saddle-bridge.js` — keep for fallback flow; new build step or copy-on-edit copies its contents into a `src-tauri/.../saddle-plugin.mjs` template

Existing utilities to reuse:
- `src/lib/tauri.ts:loadProject` (project scanning)
- `src/lib/tauri.ts:writeComponentFile` (writing the wrapper config + plugin)
- `src/tokens/tokens.ts:loadTokensFromConfig` (token detection / writing)
- The existing bridge protocol (`saddle:set-tokens`, `saddle:set-element-state`, etc.)

## Verification

1. **Smoke: Globex Design system real**
   - Open Saddle, point at `~/Documents/code-projects/Globex Design system real`
   - Expect: status pill goes `Spawning Vite…` → `Live · :NNNN` within a few seconds, no terminal needed
   - `ls .saddle/` in the project shows `vite.config.mts` + `saddle-plugin.mjs`; `.gitignore` has `.saddle/`
   - Iframe in Saddle shows the Globex showcase as before, bridge connects (Cmd-click works), token edits in the Tokens view repaint via HMR
2. **Smoke: project without Vite**
   - Point Saddle at any folder without `vite` in `package.json`
   - Expect: status pill skips spawn; Settings view shows "Connect to existing dev server" with the manual URL input as today
3. **Crash recovery**
   - With a project loaded, kill the Vite process from a terminal (`pkill -f vite`)
   - Expect: status pill flips to `Failed`, Retry button respawns Vite cleanly
4. **App quit cleanup**
   - Quit Saddle while a project is loaded
   - Expect: `ps aux | grep vite` shows the child process is gone (no orphan)
5. **User's vite plugins survive**
   - Globex uses `@vitejs/plugin-react` plus path aliases. Confirm the Saddle wrapper preserves these — Vite serves with React + alias resolution working
6. **Bridge handshake**
   - Iframe loads, Saddle's status strip shows the green dot ("bridge ready"). Cmd-click an element → Style panel opens with computed styles. No manual import in `main.tsx`.
