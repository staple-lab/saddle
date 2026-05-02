# Smoke checklist — component manifest & editor redesign

Run through this list against a real project (e.g. `~/saddle-test`) before merging the implementation. Each item should pass.

| # | Step | Expected |
|---|---|---|
| 1 | Fresh project with no `saddle.manifest.json` → Load Project | Picker opens automatically with default selections (files inside `components` folders, test/spec/stories unchecked). |
| 2 | In picker, save manifest | Modal closes; `saddle.manifest.json` exists at project root; dropdown populates with chosen components. |
| 3 | Existing project with manifest → Load Project | No picker. Components render directly via the dropdown. |
| 4 | Click variant in dropdown | Preview reloads; Doc tab shows that variant's `.md` (auto-creates if missing). |
| 5 | Edit `.md` content, click outside the panel | After ~600 ms or on blur, `.md` file on disk reflects the change. |
| 6 | Reload the project | Markdown content persists. |
| 7 | Click an element in the preview | Right panel auto-switches to Style tab; existing token-edit behaviour intact. |
| 8 | Press Esc / click empty canvas | Active tab returns to Doc. |
| 9 | While running, `git checkout` a branch that adds a `.tsx` in a tracked component dir | Drift pill `+1 new file` appears within ~500 ms. |
| 10 | Click drift pill | Picker opens; existing selections preserved. |
| 11 | Same with deleting a tracked file | `1 missing file` pill; picker shows entry struck-through in dropdown. |
| 12 | Hand-edit `saddle.manifest.json` to reorder variants | Watcher reloads project; dropdown reflects new order. |
| 13 | Hand-corrupt manifest (e.g. replace contents with `{`) → reload project | Full-screen error: "Manifest is not valid JSON" with **Open in editor** + **Reset and re-pick**. |
| 14 | Set manifest `version` to `99` | Full-screen error: "Manifest is from a newer Saddle" with only **Open in editor** (no Reset). |
| 15 | Add a manifest entry pointing at a non-existent `.tsx` | Variant shows strikethrough + ⚠ in dropdown; selecting it shows file-not-found state with "Open picker to remove" action. |
| 16 | Empty manifest (`components: []`) | Empty-state with "Open picker" button. |
| 17 | Open picker via sidebar footer "Configure components…" | Picker opens with current manifest pre-selected. |
| 18 | All Phase 1 Rust tests pass | `cargo test --manifest-path src-tauri/Cargo.toml --lib manifest` shows 11 green. |

## Known v1 limitations

These are deliberate non-goals; do not flag them as failures:

- Root-level files (e.g. `App.tsx` directly under the project root) are filtered out of the manifest with a `console.warn` — the directory-as-component model doesn't accommodate them.
- External `.md` edits while Saddle is running silently overwrite the editor's loaded copy on next variant switch (no "external change — reload?" banner). Captured as a deferred follow-up in the design doc.
- The picker's `mode` defaults to `'first-load'` even when reached via the drift pill — `'diff'`-mode polish (green dots, struck-through entries inside the picker) is implemented but not specially triggered by drift right now.
- Windows is not a target platform; the atomic temp-then-rename and `.tmp` filename behaviour have not been verified there.
