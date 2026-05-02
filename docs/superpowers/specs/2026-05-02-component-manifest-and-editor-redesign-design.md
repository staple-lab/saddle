# Component manifest, point-and-click picker, and editor redesign

**Status:** approved (brainstorm 2026-05-02)
**Topic:** Replace auto-discovery component import with an authoritative project manifest, add a tree-with-checkboxes picker for choosing what's in the gallery, surface a permanent per-variant markdown editor in the editor view, and replace the sidebar's component nav with a dropdown.

---

## 1. Goals

- **Make gallery membership explicit and editable.** Users pick exactly which files Saddle treats as components/variants, by point-and-click. No surprises from auto-discovery.
- **Give every variant a long-form doc.** A sibling `.md` file per variant, edited inside Saddle with live preview, always visible.
- **Tighten the editor's information density.** Replace the sidebar component nav with a dropdown above the preview so the markdown panel can be a permanent fixture.
- **Don't break existing projects.** Migration from today's auto-discovery world should be a single picker pass.

Non-goals for v1:
- Moving frontmatter fields (description, usage, AI guidance) out of `.tsx` files. Frontmatter stays where it is.
- JSON5 / commented manifests.
- React / Vitest test infra. Tests are Rust-only.
- Multi-project / workspace manifests.

## 2. Architecture

### 2.1 Files on disk

- **`saddle.manifest.json`** — new file at the project root. Single source of truth for the gallery. Schema in §3.
- **`<Component>.<Variant>.md`** — new sibling file per variant (e.g. `Button.Primary.md` next to `Button.Primary.tsx`). Auto-created on first view.
- **`saddle.config.json`** — unchanged. Continues to hold tokens. Components-path / extensions fields, if present, become legacy hints used only as picker pre-check defaults.

### 2.2 Loading pipeline

The frontend `loadProject` (`src/lib/tauri.ts`) stops walking directories for component discovery. New flow:

1. Read `saddle.manifest.json` via a new Rust command `read_manifest`.
2. For each variant entry, read the `.tsx` file (existing `read_component_file` + `parse_component_file`).
3. For each variant entry, read the `.md` file. If it doesn't exist, write a templated body (§6.1), then read it.
4. Construct the same `ProjectStructure` shape today's UI consumes, with one added field per variant: `docPath: string` and `docContent: string`.

The existing Rust `scan_project_directory` command stays — it's only used by the picker to render the project tree.

### 2.3 Editor pipeline

`EditorView` (`src/views/EditorView.tsx`) gets two structural changes:

- A new combobox above the preview, replacing the sidebar's role of switching components. Single dropdown, grouped by component → variant.
- A permanent right panel. The today's element-only inspector becomes a tab strip on this panel: `Doc | Style | Code | AI | Metadata`. `Doc` is the markdown editor and is the resting tab; the others auto-activate on element selection and show empty states otherwise.

`Sidebar.tsx` loses its **Components** section. Tokens / Hierarchy / Export / Settings remain. The sidebar collapses to a 44 px icon rail by default. Picker entry point moves to a "Configure components…" item in the sidebar footer.

### 2.4 Drift watcher

The existing `watchProject` in `src-tauri/src/file_watcher.rs` is extended to emit a `manifest-drift` Tauri event when a tracked directory sees `create` or `remove` events for files matching active extensions. The frontend renders a pill near the dropdown that, when clicked, opens the picker in **diff mode** (§4.4). 400 ms debounce.

## 3. Manifest schema

```json
{
  "$schema": "saddle/manifest/v1",
  "version": 1,
  "components": [
    {
      "id": "button",
      "name": "Button",
      "directory": "src/components/Button",
      "variants": [
        {
          "id": "button-primary",
          "name": "Primary",
          "file": "Button.Primary.tsx",
          "doc": "Button.Primary.md"
        },
        {
          "id": "button-ghost",
          "name": "Ghost",
          "file": "Button.Ghost.tsx",
          "doc": "Button.Ghost.md"
        }
      ]
    }
  ]
}
```

### 3.1 Field rules

- All `directory`, `file`, `doc` paths are **relative to the project root**, forward-slash, normalised on write.
- `id` is a stable slug, generated from `name` on first add. Manual edits OK if unique within the manifest. Used as React keys, watcher targets, and (later) MCP tool identifiers.
- `name` is the display label.
- `directory` is informational — used to scope the drift watcher and for picker UI.
- `doc` is **always present**. If the file doesn't exist on disk, Saddle creates it on first view (§6.1).
- `version: 1` is the only accepted version in this release. Higher versions trigger a hard error (§7).

### 3.2 Validation on read

- Top-level shape: object with `version: 1` and `components: array`.
- Per component: `id`, `name`, `directory` non-empty strings; `variants` non-empty array.
- Per variant: `id`, `name`, `file`, `doc` non-empty strings.
- All paths must (a) be relative, (b) resolve inside the project root after path normalisation (no `..` traversal), (c) for `file` only, exist on disk.
- Duplicate `id`s anywhere in the manifest is a parse error.
- Missing `.md` files are silently auto-created — not validation errors.
- Missing `.tsx` files surface as drift (§7), not parse errors.

### 3.3 Serialisation

- Atomic write: temp file in same directory + `rename`.
- Field order: stable, sorted as in the schema example. Two-space indent. Trailing newline.
- On re-save, existing variants are matched by `file` path and keep their existing `id`s.

## 4. Picker

The picker replaces the body of `src/components/ProjectSetupWizard.tsx`. Same modal slot, new contents.

### 4.1 Tree

- Source: `scan_project_directory(projectRoot)` — re-scanned on every open.
- Rendered as a virtualised tree (existing `node_modules` filtering already done server-side).
- Each leaf shows: checkbox, file icon, filename, optional muted reason ("test file", "not a component file", "auto-skipped").
- Folder rows show a tri-state checkbox — **none / partial ▪ / all**. Toggling a folder toggles only children that match the active extensions. Recursion is depth-first.

### 4.2 Filters

- Extension chips: `.tsx`, `.jsx`, `.ts`, `.js`. Toggling off an extension hides matching files from the tree and clears their selection.
- Free-text filter input matches against full path, component folder name, and filename. Folders that contain a match stay expanded with their matching children visible.

### 4.3 Pre-check defaults

- On **first** open (no existing manifest):
  - Files matching active extensions inside any folder named `components` are pre-checked.
  - Files matching `*.test.*`, `*.spec.*`, or `*.stories.*` are visible-but-unchecked, with a muted "auto-skipped" tag.
  - If `saddle.config.json` from a legacy project contains a `componentPath`, that subtree is expanded and pre-checked instead of the generic `components` heuristic.
- On **re-open** with an existing manifest: the current manifest's selected files are checked; everything else unchecked.

### 4.4 Diff mode

Entered when the user clicks the drift pill. Same picker UI plus:

- New-on-disk files (present in the tree but not in the current manifest) get a green dot to the right of the filename.
- Manifest entries whose files are missing on disk render at the top of the tree, struck-through, in a "Missing files" group with a "Remove from manifest" toggle pre-checked.
- Footer gets an extra toggle: **Auto-add new files** (default on). When on, save adds all green-dot files to the manifest under their inferred component folder; when off, save only acts on files the user explicitly checked/unchecked.

### 4.5 Save

- Builds the manifest from the checked set:
  - Group leaf files by their parent directory → that directory becomes one `component`. `name` = directory's last path segment, verbatim (today's `loadProject` uses `dir.name` as-is; we preserve that).
  - Variant `name` = the part of the filename between the component name and the extension (e.g. `Button.Primary.tsx` → `Primary`). Bare `<Component>.<ext>` → `Default`. `index.<ext>` → `Default`.
  - Existing entries (matched by `file` path) keep their `id`s.
- Writes via the new `write_manifest` Rust command (atomic temp-then-rename).
- Closes the modal and triggers a project reload.

### 4.6 Entry points

| Entry | Trigger |
|---|---|
| First-load auto-open | Project loads, `saddle.manifest.json` is missing. |
| Sidebar footer | "Configure components…" item in the sidebar footer (replaces today's "Settings" affordance for non-token configuration). |
| Drift pill | Pill in the editor header, click → picker in diff mode. |
| Recovery flow | "Reset and re-pick" button on the broken-manifest error screen. |

## 5. Editor view layout

### 5.1 Structure

```
┌───┬─────────────────────────────────────┬──────────────────────────────┐
│   │  ⌃ Button · Primary  ▾  +2 new      │ Doc | Style | Code | AI | …  │
│ ▌ ├─────────────────────────────────────┼──────────────────────────────┤
│   │                                     │  ┌─────────────┬───────────┐ │
│   │       [ component preview ]         │  │  textarea   │  preview  │ │
│   │                                     │  └─────────────┴───────────┘ │
└───┴─────────────────────────────────────┴──────────────────────────────┘
 rail            center column                  permanent right panel
```

- **Rail** (44 px): Tokens, Hierarchy, Export, Settings. Collapsible to fully hidden.
- **Center column**: header row (dropdown + drift pill + dev-server status) + preview.
- **Right panel**: header tab strip + content. Width: ResizablePanel, default 480 px, min 320, max 720.

### 5.2 Dropdown

- Combobox button labelled `<Component> · <Variant>` with chevron.
- Open: floating panel, grouped by component. Each group header = component name; rows = variants.
- Keyboard: ↑ ↓ to move, Enter to commit, type-to-filter (substring match across `<Component>.<Variant>`).
- Switching variant unmounts the preview iframe (existing behaviour) and loads the new variant's `.md`.

### 5.3 Tab strip

- Tabs: `Doc`, `Style`, `Code`, `AI`, `Metadata` — in this order. `Doc` is left-most.
- Default active tab: `Doc`.
- On element selection (existing `onElementSelected` handler in `EditorView`): auto-switch to `Style`. Preserve `Doc`'s edit state.
- On deselection (Esc / canvas click): auto-switch back to `Doc`.
- `Style` / `Code` / `AI` / `Metadata` clicked with no element selected: render an empty state — "Select an element in the preview to inspect."

### 5.4 Doc tab

- Side-by-side: textarea on the left (Monaco, `markdown` language), rendered HTML on the right.
- Text editor and preview share the same internal markdown state.
- Save behaviour: debounced 600 ms while typing; immediate on blur; immediate on variant switch. Save target = the variant's `doc` path.
- Width split: 50/50, draggable splitter persisted in localStorage per project.
- Empty state when no project loaded: instructions for loading a project + "Load Project" button.

### 5.5 Sidebar changes

`Sidebar.tsx`:
- Remove the **Components** `Section` (and its `filteredComponents` mapping).
- Keep the Tokens, Views, Ship sections.
- Footer: replace the single "Settings / Load Project" button with two items — "Configure components…" (opens picker) and "Settings" (existing dashboard view).
- Default-collapse to the 44 px rail when a project is loaded; user can expand for full labels.

## 6. Markdown lifecycle

### 6.1 Auto-creation template

When a variant's `doc` file doesn't exist:

```markdown
# {ComponentName} · {VariantName}

{frontmatter.description, if present}

## Usage

{frontmatter.usage, if present, else: "Document when and how to use this variant."}
```

If neither field is present, the body is just the heading. Trailing newline.

### 6.2 Independence from frontmatter

- The `.tsx` file's YAML frontmatter is left untouched.
- After the initial seed, `.md` and frontmatter are independent. Saddle does not synchronise them.
- The `Metadata` and `AI` tabs continue to read/write frontmatter as today.
- v1 does **not** offer a "move frontmatter into .md" migration action. A user who wants to consolidate does it by hand.

### 6.3 External edits

- The existing project file watcher already emits `file-changed` events. When a `.md` listed in the manifest changes on disk and the editor has **no unsaved local changes for that file in this session**, reload its content into the editor silently.
- If the user has unsaved changes, surface an "External change to `<file>` — reload?" inline banner with reload / keep-mine actions. No auto-merge.

### 6.4 Manifest hand-edits

- The watcher reloads the project on `saddle.manifest.json` change.
- Strict JSON only. JSON5 / comments → parse error → §7 broken-manifest flow.

## 7. Error handling

| Failure | UX | Recovery |
|---|---|---|
| Manifest missing on project load | Picker opens automatically (no error toast) | User saves → manifest exists |
| Manifest invalid JSON | Full-screen error: "Manifest at `<path>` is not valid JSON. **Open in editor** / **Reset and re-pick**" | Reset archives the bad file as `saddle.manifest.json.bak-<unix-ts>` and opens picker |
| Manifest `version` > 1 | Full-screen error: "Manifest was written by a newer Saddle. Update Saddle to continue." Single **Open in editor** action. **No reset offered** | Manual: upgrade Saddle |
| Manifest entry's `.tsx` missing | Variant appears in dropdown with strikethrough + warning glyph; selecting shows inline error in preview area: "File not found: `<path>`. Remove from manifest?" | Inline button removes one; drift mode handles bulk |
| `.md` write fails | Toast in terminal feed: "Failed to save `<path>`: <reason>". Editor content preserved in memory; "Retry save" pill in panel header | Manual retry |
| Picker save fails | Picker stays open with inline error banner; selections preserved | Retry "Save manifest" |
| Watcher init fails | Existing warning. Drift pill never appears; picker still reachable from sidebar footer | Manual picker re-run |
| Empty manifest (`components: []`) | Editor renders dropdown disabled with empty state: "No components in manifest — open the picker." Not an error | "Open picker" button |
| Concurrent manifest edit | Watcher reloads project. In-flight `.md` save proceeds against pre-reload state (independent file) | None needed |

## 8. Backend changes

### 8.1 New Rust commands

In a new module `src-tauri/src/manifest.rs`:

- `read_manifest(project_root: String) -> Result<Manifest, ManifestError>`
  - Errors: `NotFound`, `InvalidJson(String)`, `UnsupportedVersion(u32)`, `ValidationError(String)`.
  - Frontend distinguishes via the error variant.
- `write_manifest(project_root: String, manifest: Manifest) -> Result<(), String>` — atomic temp-then-rename.

### 8.2 Updated commands

- `watch_project` (in `file_watcher.rs`): in addition to existing `file-changed` events, when changes touch tracked component dirs, emit `manifest-drift` events: `{ added: string[], removed: string[] }`. 400 ms debounce.

### 8.3 Existing commands (no change)

`scan_project_directory`, `read_component_file`, `write_component_file`, `parse_component_file`, `update_tokens`, `load_global_config`, `create_variant`, `detect_vite`, `spawn_dev_server`, `kill_dev_server`, `analyze_*`, `build_package`.

## 9. Migration

- Projects without `saddle.manifest.json` fall through to the picker auto-open (§4.6). The picker pre-checks based on legacy `saddle.config.json` hints (§4.3). No silent in-place migration — the user always confirms by saving the picker.
- Legacy `saddle.config.json` is **not deleted**. Its `componentPath` / `extensions` fields are ignored by the loader once a manifest exists (the manifest is authoritative).
- For the test fixture project (`~/saddle-test`): include a hand-written `saddle.manifest.json` and pre-seeded `.md` files in the repo so smoke testing works without re-running the picker.

## 10. Testing

No new test infra. Coverage limits scoped to where correctness matters most — manifest parsing.

### 10.1 Rust unit tests in `src-tauri/src/manifest.rs`

- `parse_manifest_v1_roundtrip` — JSON → struct → JSON is byte-stable.
- `parse_rejects_higher_version` — `version: 2` returns `UnsupportedVersion(2)`.
- `parse_rejects_invalid_paths` — `..` / absolute / outside-root paths rejected.
- `parse_rejects_duplicate_ids` — duplicate `id` returns `ValidationError`.
- `merge_diff_preserves_ids` — re-saving with one new file preserves existing entries' `id`s.
- `seed_doc_template_from_frontmatter` — covers four cases: full frontmatter / no description / no usage / neither.

### 10.2 Manual smoke checklist

A scripted manual checklist saved alongside this spec, verified before merging the implementation. Sequence:

1. Fresh project, no manifest → picker opens automatically; save → manifest exists, dropdown populates.
2. Existing project with manifest → no picker, components render.
3. Switch variant via dropdown → preview reloads; `.md` loads (or auto-creates).
4. Edit `.md`, blur; reload project → edits persist.
5. Click element → tab auto-switches to Style; existing token-edit behaviour intact.
6. Esc → tab returns to Doc.
7. `git checkout` adds a `.tsx` in tracked dir → drift pill `+1 new file` ≤ 500 ms; click → picker diff mode flags the file.
8. Same with deletion → `1 missing file`.
9. Hand-edit manifest order → file watcher reloads project; dropdown reflects new order.
10. Corrupt manifest with bad JSON → full-screen error; "Reset and re-pick" archives + reopens picker.
11. `version: 99` → "Update Saddle" message, no reset offered.
12. Manifest entry with non-existent file → strikethrough in dropdown, inline error on selection.

## 11. Open items deferred from v1

- "Move usage from frontmatter into .md" one-click action.
- JSON5 / commented manifests.
- Manifest-driven custom display ordering of components (today: array order in manifest).
- Multi-root / monorepo manifests.
- React component test infra.

---

## Appendix — file inventory

**New:**
- `saddle.manifest.json` (per project)
- `<Component>.<Variant>.md` (per variant, in component directories)
- `src-tauri/src/manifest.rs`
- `docs/superpowers/specs/2026-05-02-component-manifest-and-editor-redesign-smoke.md`

**Modified:**
- `src/lib/tauri.ts` — `loadProject` reads manifest; new `readManifest` / `writeManifest` wrappers; `ProjectStructure` gains `docPath` / `docContent` per variant.
- `src/components/ProjectSetupWizard.tsx` — body replaced with tree picker.
- `src/views/EditorView.tsx` — dropdown, permanent right panel, tab strip auto-switch.
- `src/views/GalleryView.tsx` — wire drift pill, picker entry points; remove auto-load extensions argument from wizard call.
- `src/components/Sidebar.tsx` — remove Components section, default-collapse rail, footer items.
- `src-tauri/src/file_watcher.rs` — `manifest-drift` event emission.
- `src-tauri/src/lib.rs` — register new commands.
