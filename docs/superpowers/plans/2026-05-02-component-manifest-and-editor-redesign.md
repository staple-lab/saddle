# Component Manifest, Picker, and Editor Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace auto-discovery component import with an authoritative project-level manifest, add a tree-with-checkboxes picker, give every variant a sibling `.md` doc with a permanent editor, and replace the sidebar's component nav with a dropdown above the preview.

**Architecture:** A new Rust module (`manifest.rs`) holds the typed manifest, parser, validator, and serializer; two new Tauri commands (`read_manifest`, `write_manifest`) expose it. The frontend's `loadProject` is rewritten to consume the manifest instead of walking directories; the `ProjectSetupWizard` body is replaced with a tree picker; `EditorView` gains a component dropdown above the preview and a permanent right panel whose default tab (`Doc`) is a markdown editor with live preview. The existing file watcher is extended to emit `manifest-drift` events; a pill in the editor header opens the picker in diff mode.

**Tech Stack:** React 19, TypeScript, Tauri 2.x, Rust (notify, serde, serde_json), Monaco editor (existing dep), Lucide icons (existing dep), `react-markdown` (new dep, added in Task 21).

**Spec:** `docs/superpowers/specs/2026-05-02-component-manifest-and-editor-redesign-design.md`

---

## File Inventory

**New files:**
- `src-tauri/src/manifest.rs` — typed manifest, parser, validator, serializer, doc-template seeder.
- `src/types/manifest.ts` — TypeScript shape mirror of the Rust types.
- `src/components/ManifestPicker.tsx` — tree-with-checkboxes picker (replaces wizard body).
- `src/components/ManifestPicker.module.css` — picker styles.
- `src/components/ComponentDropdown.tsx` — combobox above preview.
- `src/components/MarkdownEditor.tsx` — textarea + live preview panel.
- `src/components/DriftPill.tsx` — `+N new files` pill.
- `docs/superpowers/specs/2026-05-02-component-manifest-and-editor-redesign-smoke.md` — manual smoke checklist.

**Modified files:**
- `src-tauri/src/lib.rs` — register new commands.
- `src-tauri/src/file_watcher.rs` — emit `manifest-drift` events.
- `src/types/component.ts` — add `docPath` and `docContent` to `ComponentVariant`.
- `src/lib/tauri.ts` — `readManifest` / `writeManifest` wrappers; rewrite `loadProject`.
- `src/components/ProjectSetupWizard.tsx` — body replaced by `ManifestPicker`.
- `src/views/EditorView.tsx` — dropdown header, permanent right panel, tab strip with auto-switch.
- `src/views/GalleryView.tsx` — wire drift pill, picker entry points, manifest auto-open.
- `src/components/Sidebar.tsx` — remove Components section, default-collapse rail, footer items.
- `package.json` — add `react-markdown`.
- `.gitignore` — already has `.superpowers/` from spec commit.

---

## Phase 0 — Setup

### Task 1: Verify a clean working tree and dev server runs

**Files:** none (setup only)

- [ ] **Step 1: Verify clean working tree**

```bash
git -C /Users/patrick/Documents/code-projects/saddle status
```

Expected: `nothing to commit, working tree clean` on branch `pat-branch` (or whichever branch the spec was committed to).

- [ ] **Step 2: Verify the Tauri app builds and runs**

```bash
cd /Users/patrick/Documents/code-projects/saddle && npm run tauri dev
```

Expected: Vite starts, Rust compiles (warnings OK), Saddle window opens, "Welcome to Saddle" screen renders. Close the window when verified.

- [ ] **Step 3: No commit (setup verification only)**

---

## Phase 1 — Manifest module (Rust, TDD)

All Rust tests run with `cargo test --manifest-path /Users/patrick/Documents/code-projects/saddle/src-tauri/Cargo.toml --lib manifest`.

### Task 2: Scaffold `manifest.rs` and register the module

**Files:**
- Create: `src-tauri/src/manifest.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create empty module file**

```rust
// src-tauri/src/manifest.rs
//! Authoritative project manifest. Source of truth for what components
//! and variants Saddle shows in the gallery.

#[cfg(test)]
mod tests {
    #[test]
    fn module_compiles() {
        assert_eq!(2 + 2, 4);
    }
}
```

- [ ] **Step 2: Register module in `lib.rs`**

In `src-tauri/src/lib.rs`, after line 10 (`mod dev_server;`), add:

```rust
mod manifest;
```

- [ ] **Step 3: Run tests to verify scaffold compiles**

```bash
cd /Users/patrick/Documents/code-projects/saddle && cargo test --manifest-path src-tauri/Cargo.toml --lib manifest
```

Expected: PASS with `1 passed`.

- [ ] **Step 4: Commit**

```bash
cd /Users/patrick/Documents/code-projects/saddle
git add src-tauri/src/manifest.rs src-tauri/src/lib.rs
git commit -m "feat(manifest): scaffold manifest module"
```

---

### Task 3: `Manifest` types and JSON roundtrip

**Files:**
- Modify: `src-tauri/src/manifest.rs`

- [ ] **Step 1: Write the failing roundtrip test**

Replace the entire contents of `src-tauri/src/manifest.rs` with:

```rust
//! Authoritative project manifest. Source of truth for what components
//! and variants Saddle shows in the gallery.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Manifest {
    #[serde(rename = "$schema", default = "default_schema")]
    pub schema: String,
    pub version: u32,
    pub components: Vec<ManifestComponent>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ManifestComponent {
    pub id: String,
    pub name: String,
    pub directory: String,
    pub variants: Vec<ManifestVariant>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ManifestVariant {
    pub id: String,
    pub name: String,
    pub file: String,
    pub doc: String,
}

fn default_schema() -> String {
    "saddle/manifest/v1".to_string()
}

#[derive(Debug, thiserror::Error)]
pub enum ManifestError {
    #[error("manifest file not found at {0}")]
    NotFound(String),
    #[error("manifest is not valid JSON: {0}")]
    InvalidJson(String),
    #[error("manifest version {0} is newer than this Saddle build supports")]
    UnsupportedVersion(u32),
    #[error("manifest validation failed: {0}")]
    ValidationError(String),
    #[error("io error: {0}")]
    Io(String),
}

pub fn parse_manifest(content: &str) -> Result<Manifest, ManifestError> {
    serde_json::from_str::<Manifest>(content).map_err(|e| ManifestError::InvalidJson(e.to_string()))
}

pub fn serialize_manifest(manifest: &Manifest) -> String {
    serde_json::to_string_pretty(manifest).expect("manifest serialization is infallible") + "\n"
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Manifest {
        Manifest {
            schema: "saddle/manifest/v1".to_string(),
            version: 1,
            components: vec![ManifestComponent {
                id: "button".to_string(),
                name: "Button".to_string(),
                directory: "src/components/Button".to_string(),
                variants: vec![ManifestVariant {
                    id: "button-primary".to_string(),
                    name: "Primary".to_string(),
                    file: "Button.Primary.tsx".to_string(),
                    doc: "Button.Primary.md".to_string(),
                }],
            }],
        }
    }

    #[test]
    fn parse_manifest_v1_roundtrip() {
        let original = sample();
        let json = serialize_manifest(&original);
        let parsed = parse_manifest(&json).expect("roundtrip parse");
        assert_eq!(parsed, original);
    }
}
```

Add `thiserror` to `src-tauri/Cargo.toml` `[dependencies]` if not already present:

```bash
cd /Users/patrick/Documents/code-projects/saddle/src-tauri && cargo add thiserror
```

- [ ] **Step 2: Run the test — expect PASS**

```bash
cd /Users/patrick/Documents/code-projects/saddle && cargo test --manifest-path src-tauri/Cargo.toml --lib manifest
```

Expected: PASS. (We wrote the implementation in the same step as the test because the type definitions are required for the test to compile at all.)

- [ ] **Step 3: Commit**

```bash
cd /Users/patrick/Documents/code-projects/saddle
git add src-tauri/src/manifest.rs src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "feat(manifest): add Manifest types and JSON roundtrip"
```

---

### Task 4: Reject unsupported manifest versions

**Files:**
- Modify: `src-tauri/src/manifest.rs`

- [ ] **Step 1: Write the failing version-rejection test**

In `src-tauri/src/manifest.rs`, append inside `mod tests`:

```rust
    #[test]
    fn parse_rejects_higher_version() {
        let json = r#"{"$schema":"saddle/manifest/v1","version":2,"components":[]}"#;
        match parse_manifest(json) {
            Err(ManifestError::UnsupportedVersion(2)) => {}
            other => panic!("expected UnsupportedVersion(2), got {:?}", other),
        }
    }
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd /Users/patrick/Documents/code-projects/saddle && cargo test --manifest-path src-tauri/Cargo.toml --lib manifest::tests::parse_rejects_higher_version
```

Expected: FAIL — current `parse_manifest` accepts any `version`.

- [ ] **Step 3: Implement version check**

In `src-tauri/src/manifest.rs`, replace the body of `pub fn parse_manifest` with:

```rust
pub fn parse_manifest(content: &str) -> Result<Manifest, ManifestError> {
    let manifest: Manifest = serde_json::from_str(content)
        .map_err(|e| ManifestError::InvalidJson(e.to_string()))?;
    if manifest.version != 1 {
        return Err(ManifestError::UnsupportedVersion(manifest.version));
    }
    Ok(manifest)
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd /Users/patrick/Documents/code-projects/saddle && cargo test --manifest-path src-tauri/Cargo.toml --lib manifest
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
cd /Users/patrick/Documents/code-projects/saddle
git add src-tauri/src/manifest.rs
git commit -m "feat(manifest): reject unsupported manifest versions"
```

---

### Task 5: Validate paths (relative, no traversal)

**Files:**
- Modify: `src-tauri/src/manifest.rs`

- [ ] **Step 1: Write the failing path-validation tests**

Append inside `mod tests`:

```rust
    fn make_manifest_with_paths(component_dir: &str, file: &str, doc: &str) -> String {
        format!(
            r#"{{"$schema":"saddle/manifest/v1","version":1,"components":[{{"id":"x","name":"X","directory":"{}","variants":[{{"id":"x-d","name":"D","file":"{}","doc":"{}"}}]}}]}}"#,
            component_dir, file, doc
        )
    }

    #[test]
    fn parse_rejects_absolute_directory() {
        let json = make_manifest_with_paths("/abs/path", "X.tsx", "X.md");
        match parse_manifest(&json) {
            Err(ManifestError::ValidationError(msg)) => assert!(msg.contains("absolute"), "msg: {}", msg),
            other => panic!("expected ValidationError, got {:?}", other),
        }
    }

    #[test]
    fn parse_rejects_traversal_in_file() {
        let json = make_manifest_with_paths("src/x", "../sneak.tsx", "X.md");
        match parse_manifest(&json) {
            Err(ManifestError::ValidationError(msg)) => assert!(msg.contains("traversal") || msg.contains("..")),
            other => panic!("expected ValidationError, got {:?}", other),
        }
    }

    #[test]
    fn parse_rejects_empty_field() {
        let json = make_manifest_with_paths("src/x", "", "X.md");
        match parse_manifest(&json) {
            Err(ManifestError::ValidationError(msg)) => assert!(msg.contains("empty") || msg.contains("file")),
            other => panic!("expected ValidationError, got {:?}", other),
        }
    }
```

- [ ] **Step 2: Run — expect FAIL on all three**

```bash
cd /Users/patrick/Documents/code-projects/saddle && cargo test --manifest-path src-tauri/Cargo.toml --lib manifest
```

Expected: 3 new tests fail.

- [ ] **Step 3: Implement validation**

In `src-tauri/src/manifest.rs`, add a helper and call it from `parse_manifest`:

```rust
fn validate_path(label: &str, path: &str) -> Result<(), ManifestError> {
    if path.is_empty() {
        return Err(ManifestError::ValidationError(format!("{} is empty", label)));
    }
    if path.starts_with('/') || (path.len() >= 2 && &path[1..2] == ":") {
        return Err(ManifestError::ValidationError(format!(
            "{} '{}' must be relative (no absolute paths)",
            label, path
        )));
    }
    if path.split('/').any(|seg| seg == "..") {
        return Err(ManifestError::ValidationError(format!(
            "{} '{}' contains path traversal ('..')",
            label, path
        )));
    }
    Ok(())
}

fn validate_manifest(manifest: &Manifest) -> Result<(), ManifestError> {
    for c in &manifest.components {
        if c.id.is_empty() || c.name.is_empty() {
            return Err(ManifestError::ValidationError(
                "component id/name cannot be empty".to_string(),
            ));
        }
        validate_path("component.directory", &c.directory)?;
        if c.variants.is_empty() {
            return Err(ManifestError::ValidationError(format!(
                "component '{}' has no variants",
                c.name
            )));
        }
        for v in &c.variants {
            if v.id.is_empty() || v.name.is_empty() {
                return Err(ManifestError::ValidationError(
                    "variant id/name cannot be empty".to_string(),
                ));
            }
            validate_path("variant.file", &v.file)?;
            validate_path("variant.doc", &v.doc)?;
        }
    }
    Ok(())
}
```

Update `parse_manifest`:

```rust
pub fn parse_manifest(content: &str) -> Result<Manifest, ManifestError> {
    let manifest: Manifest = serde_json::from_str(content)
        .map_err(|e| ManifestError::InvalidJson(e.to_string()))?;
    if manifest.version != 1 {
        return Err(ManifestError::UnsupportedVersion(manifest.version));
    }
    validate_manifest(&manifest)?;
    Ok(manifest)
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd /Users/patrick/Documents/code-projects/saddle && cargo test --manifest-path src-tauri/Cargo.toml --lib manifest
```

Expected: all manifest tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/patrick/Documents/code-projects/saddle
git add src-tauri/src/manifest.rs
git commit -m "feat(manifest): validate paths and required fields"
```

---

### Task 6: Reject duplicate variant ids

**Files:**
- Modify: `src-tauri/src/manifest.rs`

- [ ] **Step 1: Write the failing test**

Append inside `mod tests`:

```rust
    #[test]
    fn parse_rejects_duplicate_ids() {
        let json = r#"{
            "$schema":"saddle/manifest/v1","version":1,
            "components":[{
                "id":"button","name":"Button","directory":"src/components/Button",
                "variants":[
                    {"id":"dup","name":"A","file":"A.tsx","doc":"A.md"},
                    {"id":"dup","name":"B","file":"B.tsx","doc":"B.md"}
                ]
            }]
        }"#;
        match parse_manifest(json) {
            Err(ManifestError::ValidationError(msg)) => assert!(msg.contains("dup"), "msg: {}", msg),
            other => panic!("expected ValidationError, got {:?}", other),
        }
    }
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd /Users/patrick/Documents/code-projects/saddle && cargo test --manifest-path src-tauri/Cargo.toml --lib manifest::tests::parse_rejects_duplicate_ids
```

Expected: FAIL.

- [ ] **Step 3: Implement duplicate-id check**

In `validate_manifest`, after the existing component loop body, before its closing brace, add:

```rust
    // Globally unique variant ids — manifest-wide, not per-component.
    let mut seen_ids = std::collections::HashSet::<&str>::new();
    for c in &manifest.components {
        for v in &c.variants {
            if !seen_ids.insert(v.id.as_str()) {
                return Err(ManifestError::ValidationError(format!(
                    "duplicate variant id '{}'",
                    v.id
                )));
            }
        }
    }
```

(Move this block so it runs after the per-component loop, not inside it.)

- [ ] **Step 4: Run — expect PASS**

```bash
cd /Users/patrick/Documents/code-projects/saddle && cargo test --manifest-path src-tauri/Cargo.toml --lib manifest
```

Expected: all manifest tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/patrick/Documents/code-projects/saddle
git add src-tauri/src/manifest.rs
git commit -m "feat(manifest): reject duplicate variant ids"
```

---

### Task 7: `merge_diff_preserves_ids` helper

**Files:**
- Modify: `src-tauri/src/manifest.rs`

- [ ] **Step 1: Write the failing test**

Append inside `mod tests`:

```rust
    #[test]
    fn merge_diff_preserves_ids() {
        // Existing manifest with one variant.
        let existing = sample();

        // Picker emits a "desired" manifest with the existing variant + a new one.
        // The new one's id is a placeholder ("__new__") that merge should replace.
        let desired = Manifest {
            schema: "saddle/manifest/v1".to_string(),
            version: 1,
            components: vec![ManifestComponent {
                id: "button".to_string(),
                name: "Button".to_string(),
                directory: "src/components/Button".to_string(),
                variants: vec![
                    ManifestVariant {
                        id: "__new__".to_string(),
                        name: "Primary".to_string(),
                        file: "Button.Primary.tsx".to_string(),
                        doc: "Button.Primary.md".to_string(),
                    },
                    ManifestVariant {
                        id: "__new__".to_string(),
                        name: "Ghost".to_string(),
                        file: "Button.Ghost.tsx".to_string(),
                        doc: "Button.Ghost.md".to_string(),
                    },
                ],
            }],
        };

        let merged = merge_preserve_ids(&existing, desired);

        // First variant matches existing by `file`, so id is preserved.
        assert_eq!(merged.components[0].variants[0].id, "button-primary");
        // Second variant is new — gets a freshly slugged id, not "__new__".
        assert_ne!(merged.components[0].variants[1].id, "__new__");
        assert!(!merged.components[0].variants[1].id.is_empty());
    }
```

- [ ] **Step 2: Run — expect FAIL (function does not exist)**

```bash
cd /Users/patrick/Documents/code-projects/saddle && cargo test --manifest-path src-tauri/Cargo.toml --lib manifest::tests::merge_diff_preserves_ids
```

Expected: compile error — `merge_preserve_ids` not defined.

- [ ] **Step 3: Implement**

In `src-tauri/src/manifest.rs`, append above `mod tests`:

```rust
/// Merge a freshly-built ("desired") manifest with an existing one,
/// preserving stable `id` values for variants matched by `file` path
/// and for components matched by `directory` path. Variants in the
/// desired manifest with no match get a freshly slugged id.
pub fn merge_preserve_ids(existing: &Manifest, mut desired: Manifest) -> Manifest {
    for c in &mut desired.components {
        if let Some(existing_c) = existing
            .components
            .iter()
            .find(|ec| ec.directory == c.directory)
        {
            c.id = existing_c.id.clone();
        } else {
            c.id = slugify(&c.name);
        }

        for v in &mut c.variants {
            let match_in_existing_c = existing
                .components
                .iter()
                .find(|ec| ec.directory == c.directory)
                .and_then(|ec| ec.variants.iter().find(|ev| ev.file == v.file));

            if let Some(existing_v) = match_in_existing_c {
                v.id = existing_v.id.clone();
            } else {
                v.id = slugify(&format!("{}-{}", c.name, v.name));
            }
        }
    }
    desired
}

fn slugify(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut prev_dash = false;
    for ch in input.chars() {
        if ch.is_ascii_alphanumeric() {
            for c in ch.to_lowercase() {
                out.push(c);
            }
            prev_dash = false;
        } else if !prev_dash && !out.is_empty() {
            out.push('-');
            prev_dash = true;
        }
    }
    while out.ends_with('-') {
        out.pop();
    }
    out
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd /Users/patrick/Documents/code-projects/saddle && cargo test --manifest-path src-tauri/Cargo.toml --lib manifest
```

Expected: all manifest tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/patrick/Documents/code-projects/saddle
git add src-tauri/src/manifest.rs
git commit -m "feat(manifest): merge_preserve_ids and slugify"
```

---

### Task 8: `seed_doc_template` from frontmatter

**Files:**
- Modify: `src-tauri/src/manifest.rs`

- [ ] **Step 1: Write the failing test**

Append inside `mod tests`:

```rust
    #[test]
    fn seed_doc_template_from_frontmatter() {
        // Full frontmatter
        let body = seed_doc_template("Button", "Primary", Some("A primary CTA."), Some("Use for the main action on a page."));
        assert!(body.starts_with("# Button · Primary"));
        assert!(body.contains("A primary CTA."));
        assert!(body.contains("## Usage"));
        assert!(body.contains("Use for the main action on a page."));

        // No description
        let body = seed_doc_template("Card", "Default", None, Some("Wrap content."));
        assert!(body.starts_with("# Card · Default"));
        assert!(!body.contains("A primary CTA."));
        assert!(body.contains("Wrap content."));

        // No usage
        let body = seed_doc_template("Modal", "Sheet", Some("A bottom sheet modal."), None);
        assert!(body.contains("A bottom sheet modal."));
        assert!(body.contains("Document when and how to use this variant."));

        // Neither
        let body = seed_doc_template("Tooltip", "Default", None, None);
        assert!(body.starts_with("# Tooltip · Default"));
        // Just heading + trailing newline
        let trimmed = body.trim();
        assert_eq!(trimmed, "# Tooltip · Default");
    }
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd /Users/patrick/Documents/code-projects/saddle && cargo test --manifest-path src-tauri/Cargo.toml --lib manifest::tests::seed_doc_template_from_frontmatter
```

Expected: compile error — function not defined.

- [ ] **Step 3: Implement**

In `src-tauri/src/manifest.rs`, append above `mod tests`:

```rust
/// Build the body of a freshly-created variant `.md` doc using the
/// optional `description` and `usage` fields lifted from the variant's
/// `.tsx` frontmatter. If neither is present, returns just the heading.
pub fn seed_doc_template(
    component_name: &str,
    variant_name: &str,
    description: Option<&str>,
    usage: Option<&str>,
) -> String {
    let heading = format!("# {} · {}", component_name, variant_name);
    match (description, usage) {
        (None, None) => format!("{}\n", heading),
        (desc, usage) => {
            let desc_block = desc.map(|d| format!("\n{}\n", d.trim())).unwrap_or_default();
            let usage_text = usage
                .map(|u| u.trim().to_string())
                .unwrap_or_else(|| "Document when and how to use this variant.".to_string());
            format!("{}\n{}\n## Usage\n\n{}\n", heading, desc_block, usage_text)
        }
    }
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd /Users/patrick/Documents/code-projects/saddle && cargo test --manifest-path src-tauri/Cargo.toml --lib manifest
```

Expected: all manifest tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/patrick/Documents/code-projects/saddle
git add src-tauri/src/manifest.rs
git commit -m "feat(manifest): seed doc template from frontmatter"
```

---

## Phase 2 — Tauri commands

### Task 9: `read_manifest` and `write_manifest` commands

**Files:**
- Modify: `src-tauri/src/manifest.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add atomic file IO helpers to `manifest.rs`**

Append above `mod tests`:

```rust
use std::fs;
use std::path::{Path, PathBuf};

pub fn manifest_path(project_root: &Path) -> PathBuf {
    project_root.join("saddle.manifest.json")
}

pub fn read_manifest_from_disk(project_root: &Path) -> Result<Manifest, ManifestError> {
    let path = manifest_path(project_root);
    if !path.exists() {
        return Err(ManifestError::NotFound(path.to_string_lossy().to_string()));
    }
    let content = fs::read_to_string(&path).map_err(|e| ManifestError::Io(e.to_string()))?;
    parse_manifest(&content)
}

pub fn write_manifest_to_disk(project_root: &Path, manifest: &Manifest) -> Result<(), ManifestError> {
    let path = manifest_path(project_root);
    let tmp = path.with_extension("json.tmp");
    let body = serialize_manifest(manifest);
    fs::write(&tmp, body).map_err(|e| ManifestError::Io(e.to_string()))?;
    fs::rename(&tmp, &path).map_err(|e| ManifestError::Io(e.to_string()))?;
    Ok(())
}
```

- [ ] **Step 2: Add Tauri commands in `lib.rs`**

In `src-tauri/src/lib.rs`, after the existing `watch_project` command (around line 120), add:

```rust
#[derive(serde::Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
enum ReadManifestError {
    NotFound { path: String },
    InvalidJson { message: String },
    UnsupportedVersion { version: u32 },
    ValidationError { message: String },
    Io { message: String },
}

impl From<manifest::ManifestError> for ReadManifestError {
    fn from(e: manifest::ManifestError) -> Self {
        match e {
            manifest::ManifestError::NotFound(p) => Self::NotFound { path: p },
            manifest::ManifestError::InvalidJson(m) => Self::InvalidJson { message: m },
            manifest::ManifestError::UnsupportedVersion(v) => Self::UnsupportedVersion { version: v },
            manifest::ManifestError::ValidationError(m) => Self::ValidationError { message: m },
            manifest::ManifestError::Io(m) => Self::Io { message: m },
        }
    }
}

#[tauri::command]
fn read_manifest(project_root: String) -> Result<manifest::Manifest, ReadManifestError> {
    manifest::read_manifest_from_disk(std::path::Path::new(&project_root)).map_err(Into::into)
}

#[tauri::command]
fn write_manifest(project_root: String, manifest_json: String) -> Result<(), String> {
    let manifest: manifest::Manifest = serde_json::from_str(&manifest_json)
        .map_err(|e| format!("Invalid manifest JSON: {}", e))?;
    manifest::write_manifest_to_disk(std::path::Path::new(&project_root), &manifest)
        .map_err(|e| format!("{}", e))
}
```

- [ ] **Step 3: Register the commands in the invoke handler**

In `src-tauri/src/lib.rs`, inside `tauri::generate_handler![...]`, add `read_manifest,` and `write_manifest,` after `kill_dev_server`:

```rust
            kill_dev_server,
            read_manifest,
            write_manifest
```

- [ ] **Step 4: Build to verify the commands compile**

```bash
cd /Users/patrick/Documents/code-projects/saddle && cargo build --manifest-path src-tauri/Cargo.toml
```

Expected: build succeeds (warnings OK).

- [ ] **Step 5: Commit**

```bash
cd /Users/patrick/Documents/code-projects/saddle
git add src-tauri/src/manifest.rs src-tauri/src/lib.rs
git commit -m "feat(manifest): add read_manifest and write_manifest tauri commands"
```

---

## Phase 3 — TypeScript bindings

### Task 10: Manifest TS types and tauri.ts wrappers

**Files:**
- Create: `src/types/manifest.ts`
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: Create `src/types/manifest.ts`**

```typescript
// src/types/manifest.ts
// Mirror of the Rust Manifest types in src-tauri/src/manifest.rs.

export interface ManifestVariant {
  id: string;
  name: string;
  file: string; // relative to project root
  doc: string;  // relative to project root
}

export interface ManifestComponent {
  id: string;
  name: string;
  directory: string; // relative to project root
  variants: ManifestVariant[];
}

export interface Manifest {
  $schema?: string;
  version: 1;
  components: ManifestComponent[];
}

export type ReadManifestError =
  | { kind: 'not_found'; path: string }
  | { kind: 'invalid_json'; message: string }
  | { kind: 'unsupported_version'; version: number }
  | { kind: 'validation_error'; message: string }
  | { kind: 'io'; message: string };

export function isReadManifestError(e: unknown): e is ReadManifestError {
  return !!e && typeof e === 'object' && 'kind' in (e as Record<string, unknown>);
}
```

- [ ] **Step 2: Add wrappers to `src/lib/tauri.ts`**

At the bottom of `src/lib/tauri.ts`, append:

```typescript
import type { Manifest } from '../types/manifest';

export async function readManifest(projectRoot: string): Promise<Manifest> {
  return invoke<Manifest>('read_manifest', { projectRoot });
}

export async function writeManifest(projectRoot: string, manifest: Manifest): Promise<void> {
  return invoke<void>('write_manifest', {
    projectRoot,
    manifestJson: JSON.stringify(manifest),
  });
}
```

- [ ] **Step 3: Build the frontend to verify types compile**

```bash
cd /Users/patrick/Documents/code-projects/saddle && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/patrick/Documents/code-projects/saddle
git add src/types/manifest.ts src/lib/tauri.ts
git commit -m "feat(manifest): TypeScript types and Tauri wrappers"
```

---

## Phase 4 — Loader rewrite

### Task 11: Extend `ComponentVariant` with doc fields

**Files:**
- Modify: `src/types/component.ts`

- [ ] **Step 1: Add `docPath` and `docContent` fields**

In `src/types/component.ts`, replace the `ComponentVariant` interface:

```typescript
export interface ComponentVariant {
  filePath: string;
  variantName: string; // e.g., "Primary", "Secondary"
  frontmatter: ComponentFrontmatter | null;
  code: string;
  docPath: string;    // absolute path to the variant's sibling .md file
  docContent: string; // contents of the .md file (auto-created if missing)
}
```

- [ ] **Step 2: Build to confirm everything that consumes `ComponentVariant` still compiles**

```bash
cd /Users/patrick/Documents/code-projects/saddle && npx tsc --noEmit
```

Expected: errors at the call sites in `loadProject` (in `src/lib/tauri.ts`) — the variant objects don't yet supply the new fields. We fix that in the next task. Note the errors but do not commit yet.

- [ ] **Step 3: No commit (will be combined with Task 12)**

---

### Task 12: Rewrite `loadProject` to use the manifest

**Files:**
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: Replace `loadProject` body**

In `src/lib/tauri.ts`, replace the entire `loadProject` function (lines 148-290) with:

```typescript
export async function loadProject(rootPath: string): Promise<ProjectStructure> {
  const normalizedRoot = rootPath.replace(/\\/g, '/');

  const manifest = await readManifest(normalizedRoot);

  const components: Component[] = [];

  for (const mc of manifest.components) {
    const componentDir = `${normalizedRoot}/${mc.directory}`.replace(/\/+/g, '/');
    const variants: ComponentVariant[] = [];

    for (const mv of mc.variants) {
      const fullFilePath = `${normalizedRoot}/${mv.file}`.replace(/\/+/g, '/');
      const fullDocPath = `${normalizedRoot}/${mv.doc}`.replace(/\/+/g, '/');

      let parsed: { frontmatter: any; code: string } = { frontmatter: null, code: '' };
      try {
        const tsxContent = await readComponentFile(fullFilePath);
        parsed = await parseComponentFile(tsxContent);
      } catch (err) {
        console.warn(`Variant file missing or unreadable: ${fullFilePath}`, err);
        // Leave parsed empty — UI surfaces this as missing-file state.
      }

      let docContent = '';
      try {
        docContent = await readComponentFile(fullDocPath);
      } catch {
        // Doc doesn't exist yet — seed it.
        const description = parsed.frontmatter?.description as string | undefined;
        const usage = parsed.frontmatter?.usage as string | undefined;
        docContent = seedDocTemplate(mc.name, mv.name, description, usage);
        try {
          await writeComponentFile(fullDocPath, docContent);
        } catch (writeErr) {
          console.error(`Failed to seed doc at ${fullDocPath}:`, writeErr);
        }
      }

      variants.push({
        filePath: fullFilePath,
        variantName: mv.name,
        frontmatter: parsed.frontmatter,
        code: parsed.code,
        docPath: fullDocPath,
        docContent,
      });
    }

    components.push({
      name: mc.name,
      directory: componentDir,
      variants,
    });
  }

  return {
    rootPath: normalizedRoot,
    components,
    blocks: [], // Blocks are out of scope for v1 manifest; legacy callers won't depend on this list.
  };
}

function seedDocTemplate(componentName: string, variantName: string, description?: string, usage?: string): string {
  const heading = `# ${componentName} · ${variantName}`;
  if (!description && !usage) {
    return `${heading}\n`;
  }
  const descBlock = description ? `\n${description.trim()}\n` : '';
  const usageText = usage?.trim() || 'Document when and how to use this variant.';
  return `${heading}\n${descBlock}\n## Usage\n\n${usageText}\n`;
}
```

Note: `loadProject` no longer takes `componentPath` or `extensions` arguments. Callers must be updated in Task 13.

- [ ] **Step 2: Build to confirm types**

```bash
cd /Users/patrick/Documents/code-projects/saddle && npx tsc --noEmit
```

Expected: error in `src/views/GalleryView.tsx` at the `loadProject(projectRoot, componentPath, extensions)` call — fixed in next task.

- [ ] **Step 3: No commit yet (combined with Task 13)**

---

### Task 13: Update `GalleryView` to call new `loadProject` signature

**Files:**
- Modify: `src/views/GalleryView.tsx`

- [ ] **Step 1: Update the wizard-complete callback**

In `src/views/GalleryView.tsx`, replace the `handleWizardComplete` function (lines 129-173) with:

```typescript
  const handleWizardComplete = async () => {
    try {
      setLoading(true);
      setError(null);
      setShowWizard(false);

      addLog('info', `Loading project from ${projectRoot}`, 'saddle');

      const loadedProject = await loadProject(projectRoot);

      try {
        const config = await loadGlobalConfig(projectRoot);
        loadTokensFromConfig(config.tokens);
        addLog('success', 'Global tokens loaded from saddle.config.json', 'tokens');
      } catch {
        addLog('warning', 'No saddle.config.json found, using defaults', 'tokens');
      }

      setProject(loadedProject);
      addLog('success', `Loaded ${loadedProject.components.length} components`, 'saddle');

      try {
        await watchProject(projectRoot);
        addLog('info', 'File watcher started', 'watcher');

        listen<{ paths: string[]; kind: string }>('file-changed', (event) => {
          const { paths, kind } = event.payload;
          const fileNames = paths.map(p => p.split('/').pop()).join(', ');
          addLog('info', `${kind}: ${fileNames}`, 'watcher');
        });
      } catch (err) {
        addLog('warning', `File watcher failed: ${err}`, 'watcher');
      }

      await startSaddleManagedVite(projectRoot);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
      addLog('error', `Failed: ${err}`, 'saddle');
      setShowWizard(false);
    } finally {
      setLoading(false);
    }
  };
```

The handler no longer takes `componentPath` or `extensions`.

- [ ] **Step 2: Update the `ProjectSetupWizard` JSX call**

In `src/views/GalleryView.tsx`, find the wizard render block (around line 295) and update the prop:

```tsx
      {showWizard && (
        <ProjectSetupWizard
          projectRoot={projectRoot}
          onComplete={handleWizardComplete}
          onCancel={handleWizardCancel}
        />
      )}
```

The `onComplete` signature on the wizard now takes no args. We update the wizard prop type in Task 21 when we replace its body.

- [ ] **Step 3: Build to confirm types compile**

```bash
cd /Users/patrick/Documents/code-projects/saddle && npx tsc --noEmit
```

Expected: error inside `ProjectSetupWizard.tsx` because its `onComplete` is still typed as `(componentPath: string, extensions: string[]) => void`. This is OK — we'll fix the wizard in Phase 7. **Note the error and proceed.**

- [ ] **Step 4: Loosen the wizard prop type as a stop-gap**

In `src/components/ProjectSetupWizard.tsx`, change the `onComplete` prop type to:

```typescript
  onComplete: () => void;
```

And in `handleComplete`:

```typescript
  const handleComplete = () => {
    if ((selectedPath || customPath) && extensions.length > 0) {
      onComplete();
    }
  };
```

(This is a temporary state — the wizard's body will be replaced in Phase 7. We just need it to compile through Phases 4-6.)

- [ ] **Step 5: Build**

```bash
cd /Users/patrick/Documents/code-projects/saddle && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit Tasks 11-13 together**

```bash
cd /Users/patrick/Documents/code-projects/saddle
git add src/types/component.ts src/lib/tauri.ts src/views/GalleryView.tsx src/components/ProjectSetupWizard.tsx
git commit -m "feat(loader): rewrite loadProject to read manifest, seed .md sibling files"
```

---

### Task 14: Seed manifest + .md files into `~/saddle-test` fixture (manual)

**Files:** none in repo — manual fixture setup.

This task ensures the rest of Phases 5-7 have a working test target. Skip if `~/saddle-test` doesn't exist on the developer's machine.

- [ ] **Step 1: Inspect the fixture**

```bash
ls -1 ~/saddle-test/src/components 2>/dev/null || echo "no fixture"
```

If "no fixture", skip the rest of this task and use any other component library project in the smoke checklist (Task 41).

- [ ] **Step 2: Hand-write a minimal `saddle.manifest.json`**

Create `~/saddle-test/saddle.manifest.json` with one component matching whatever the fixture has, e.g.:

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
          "file": "src/components/Button/Button.Primary.tsx",
          "doc": "src/components/Button/Button.Primary.md"
        }
      ]
    }
  ]
}
```

- [ ] **Step 3: No commit (fixture lives outside the repo)**

---

## Phase 5 — Sidebar cleanup

### Task 15: Remove Components section, default-collapse, footer items

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Remove the Components `Section` block**

In `src/components/Sidebar.tsx`, delete the entire `<Section label="Components">…</Section>` block (lines 108-125 in the current file). Also delete the `filteredComponents` and `onSelectComponent` references in props that are no longer used by the sidebar itself (we still need `selectedComponent` removed from the props list because the dropdown owns selection now).

Replace the Sidebar props interface and component signature:

```typescript
interface SidebarProps {
  project: ProjectStructure | null;
  onLoadProject: () => void;
  onConfigureComponents: () => void;  // opens picker
  onExport: () => void;
  view: AppView;
  onViewChange: (view: AppView) => void;
  tokenGroup: TokenGroup;
  onTokenGroupChange: (group: TokenGroup) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}
```

Remove `onSelectComponent`, `selectedComponent`, and `onConfigure` from props. Update the destructure in the function signature accordingly.

In the `<nav>` body, remove the Components `<Section>` (and its `filteredComponents` map) entirely. Keep the Tokens, Blocks (if present), Views (Hierarchy), and Ship (Export) sections.

- [ ] **Step 2: Update the footer to two items**

Replace the footer button block (lines 174-209) with:

```tsx
        {project && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button
              onClick={onConfigureComponents}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', height: 32, padding: '0 10px',
                background: 'transparent', color: 'var(--color-fg)',
                border: 'none', borderRadius: 6,
                fontSize: 13, fontWeight: 400, cursor: 'pointer', textAlign: 'left',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <Folder size={14} style={{ flexShrink: 0, color: 'var(--color-fg-muted)' }} />
              <span>Configure components…</span>
            </button>
            <button
              onClick={() => onViewChange('settings')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', height: 32, padding: '0 10px',
                background: 'transparent', color: 'var(--color-fg)',
                border: 'none', borderRadius: 6,
                fontSize: 13, fontWeight: 400, cursor: 'pointer', textAlign: 'left',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <Settings size={14} style={{ flexShrink: 0, color: 'var(--color-fg-muted)' }} />
              <span>Settings</span>
            </button>
          </div>
        )}
        {!project && (
          <button
            onClick={onLoadProject}
            style={{
              height: 32, padding: '0 14px',
              background: 'var(--color-primary)', color: '#fff',
              border: 'none', borderRadius: 6,
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}
          >
            Load Project
          </button>
        )}
```

- [ ] **Step 3: Default the sidebar to collapsed when a project loads**

In `src/views/GalleryView.tsx`, update the initial state:

```typescript
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
```

- [ ] **Step 4: Update the GalleryView's `<Sidebar>` JSX**

In `src/views/GalleryView.tsx`, find the `<Sidebar … />` render and replace with:

```tsx
        {project && (
          <Sidebar
            project={project}
            onLoadProject={handleLoadProject}
            onConfigureComponents={() => setShowWizard(true)}
            onExport={() => { setView('export'); setSelectedComponent(null); }}
            view={view}
            onViewChange={(v) => { setView(v); if (v !== 'components') setSelectedComponent(null); }}
            tokenGroup={tokenGroup}
            onTokenGroupChange={setTokenGroup}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
          />
        )}
```

- [ ] **Step 5: Build**

```bash
cd /Users/patrick/Documents/code-projects/saddle && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Run the app and verify visually**

```bash
cd /Users/patrick/Documents/code-projects/saddle && npm run tauri dev
```

Manual checks (close the app afterwards):
- Welcome screen still renders with "Load Project".
- Loading a fixture project (assuming Task 14 fixture exists) shows the sidebar with no Components section, just Tokens + Views + Ship + footer with two items.
- Sidebar starts collapsed (44 px rail).
- Clicking the rail's expand button opens the full sidebar.

- [ ] **Step 7: Commit**

```bash
cd /Users/patrick/Documents/code-projects/saddle
git add src/components/Sidebar.tsx src/views/GalleryView.tsx
git commit -m "feat(sidebar): remove Components section, add Configure entry, default-collapse"
```

---

## Phase 6 — Component dropdown

### Task 16: Build `ComponentDropdown` component

**Files:**
- Create: `src/components/ComponentDropdown.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/ComponentDropdown.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Component, ComponentVariant } from '../types/component';

interface ComponentDropdownProps {
  components: Component[];
  selectedComponent: Component | null;
  selectedVariant: ComponentVariant | null;
  onSelect: (component: Component, variant: ComponentVariant) => void;
}

export function ComponentDropdown({
  components,
  selectedComponent,
  selectedVariant,
  onSelect,
}: ComponentDropdownProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!buttonRef.current?.contains(e.target as Node)) setOpen(false);
    };
    if (open) window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return components;
    return components
      .map((c) => ({
        ...c,
        variants: c.variants.filter((v) =>
          `${c.name}.${v.variantName}`.toLowerCase().includes(q),
        ),
      }))
      .filter((c) => c.variants.length > 0);
  }, [components, filter]);

  const label = selectedComponent && selectedVariant
    ? `${selectedComponent.name} · ${selectedVariant.variantName}`
    : 'Select component';

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          height: 28, padding: '0 10px',
          background: '#fff', border: '1px solid var(--color-border)', borderRadius: 6,
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontSize: 13, fontWeight: 500, color: 'var(--color-fg)',
          cursor: 'pointer',
        }}
      >
        <span>{label}</span>
        <span style={{ color: 'var(--color-fg-muted)', fontSize: 9 }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 32, left: 0,
            minWidth: 280, maxHeight: 360, overflow: 'auto',
            background: '#fff', border: '1px solid var(--color-border)', borderRadius: 8,
            boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
            zIndex: 50, padding: 6,
          }}
        >
          <input
            ref={inputRef}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter…"
            style={{
              width: '100%', height: 28, padding: '0 8px',
              border: '1px solid var(--color-border)', borderRadius: 6,
              fontSize: 12, marginBottom: 4, outline: 'none',
            }}
          />
          {filtered.length === 0 && (
            <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--color-fg-muted)' }}>
              No matches
            </div>
          )}
          {filtered.map((c) => (
            <div key={c.directory}>
              <div style={{ padding: '6px 8px 2px', fontSize: 10, color: 'var(--color-fg-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                {c.name}
              </div>
              {c.variants.map((v) => {
                const isActive = selectedVariant?.filePath === v.filePath;
                return (
                  <button
                    key={v.filePath}
                    type="button"
                    onClick={() => { onSelect(c, v); setOpen(false); setFilter(''); }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '6px 10px', borderRadius: 4, border: 'none',
                      background: isActive ? 'rgba(0,113,227,0.08)' : 'transparent',
                      color: 'var(--color-fg)', fontSize: 13, cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {v.variantName}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build**

```bash
cd /Users/patrick/Documents/code-projects/saddle && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/patrick/Documents/code-projects/saddle
git add src/components/ComponentDropdown.tsx
git commit -m "feat(editor): add ComponentDropdown combobox"
```

---

### Task 17: Slot dropdown into EditorView header + auto-select first variant

**Files:**
- Modify: `src/views/EditorView.tsx`
- Modify: `src/views/GalleryView.tsx`

- [ ] **Step 1: Auto-select the first component+variant when project loads**

In `src/views/GalleryView.tsx`, after `setProject(loadedProject);` inside `handleWizardComplete`, add:

```typescript
      const firstComp = loadedProject.components[0];
      if (firstComp) {
        setSelectedComponent(firstComp);
      }
```

- [ ] **Step 2: Pass components + handlers into EditorView**

In `src/views/GalleryView.tsx`, update the `<EditorView>` render:

```tsx
    if (selectedComponent) {
      return (
        <EditorView
          components={project.components}
          component={selectedComponent}
          onSelectComponent={(comp) => setSelectedComponent(comp)}
          onBack={() => setSelectedComponent(null)}
          devServerUrl={devServerUrl || undefined}
        />
      );
    }
```

- [ ] **Step 3: Update `EditorViewProps` and integrate the dropdown**

In `src/views/EditorView.tsx`, update the props interface and import:

```typescript
import { ComponentDropdown } from '../components/ComponentDropdown';
import type { Component } from '../types/component';

interface EditorViewProps {
  components: Component[];
  component: Component;
  onSelectComponent: (component: Component) => void;
  onBack: () => void;
  devServerUrl?: string;
}
```

In the component signature, destructure `components` and `onSelectComponent`. Then, at the top of the JSX (replacing the existing first child of the outer `<div>`), insert a header row:

```tsx
    <div style={{ display: 'flex', height: '100%', flex: 1, overflow: 'hidden' }}>
      <main
        onClick={(e) => { if (e.target === e.currentTarget) clearSelection(); }}
        style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--color-stage)', overflow: 'hidden' }}
      >
        <div style={{
          height: 38, padding: '0 14px',
          display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: '1px solid var(--color-border)',
          background: '#fff',
          flexShrink: 0,
        }}>
          <ComponentDropdown
            components={components}
            selectedComponent={component}
            selectedVariant={selectedVariant}
            onSelect={(comp, variant) => {
              onSelectComponent(comp);
              const idx = comp.variants.findIndex((v) => v.filePath === variant.filePath);
              if (idx >= 0) setSelectedVariantIndex(idx);
            }}
          />
        </div>

        {/* (existing preview block unchanged below) */}
```

Change `const [selectedVariantIndex] = useState(0);` to:

```typescript
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
```

- [ ] **Step 4: Build**

```bash
cd /Users/patrick/Documents/code-projects/saddle && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run the app, verify the dropdown switches components/variants**

```bash
cd /Users/patrick/Documents/code-projects/saddle && npm run tauri dev
```

Manual checks: load fixture (or any project with manifest from Task 14) → dropdown shows in header → opening it shows components grouped by name → clicking a variant changes the preview.

- [ ] **Step 6: Commit**

```bash
cd /Users/patrick/Documents/code-projects/saddle
git add src/views/EditorView.tsx src/views/GalleryView.tsx
git commit -m "feat(editor): wire component dropdown above preview"
```

---

## Phase 7 — Markdown editor and permanent right panel

### Task 18: Add `react-markdown` dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
cd /Users/patrick/Documents/code-projects/saddle && npm install react-markdown@^9
```

- [ ] **Step 2: Verify it's pinned in `package.json`**

```bash
grep '"react-markdown"' /Users/patrick/Documents/code-projects/saddle/package.json
```

Expected: a line with the version.

- [ ] **Step 3: Commit**

```bash
cd /Users/patrick/Documents/code-projects/saddle
git add package.json package-lock.json
git commit -m "chore: add react-markdown for live doc preview"
```

---

### Task 19: Build `MarkdownEditor` component

**Files:**
- Create: `src/components/MarkdownEditor.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/MarkdownEditor.tsx
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { CodeEditor } from './CodeEditor';

interface MarkdownEditorProps {
  filePath: string;
  initialContent: string;
  onSave: (path: string, content: string) => Promise<void>;
}

export function MarkdownEditor({ filePath, initialContent, onSave }: MarkdownEditorProps) {
  const [content, setContent] = useState(initialContent);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    setContent(initialContent);
  }, [filePath, initialContent]);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      onSave(filePath, content).catch((err) => console.error('md save failed', err));
    }, 600);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [content, filePath]);

  const handleBlur = () => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    onSave(filePath, content).catch((err) => console.error('md save failed', err));
  };

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <div
        style={{ flex: 1, minHeight: 0, borderRight: '1px solid var(--color-border)' }}
        onBlur={handleBlur}
      >
        <CodeEditor
          value={content}
          language="markdown"
          readOnly={false}
          onChange={(next) => setContent(next ?? '')}
        />
      </div>
      <div style={{
        flex: 1, minHeight: 0, overflow: 'auto',
        padding: '14px 16px', background: '#fff',
        fontSize: 13, lineHeight: 1.6, color: 'var(--color-fg)',
      }}>
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify `CodeEditor` accepts `language="markdown"`**

```bash
grep -n "language" /Users/patrick/Documents/code-projects/saddle/src/components/CodeEditor.tsx
```

If `CodeEditor` does not pass `language` through to Monaco, open it and add the prop. The Monaco React API takes `language` directly. Most likely the existing `CodeEditor` already accepts it (the Code tab uses `language="typescript"`).

- [ ] **Step 3: Build**

```bash
cd /Users/patrick/Documents/code-projects/saddle && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/patrick/Documents/code-projects/saddle
git add src/components/MarkdownEditor.tsx
git commit -m "feat(editor): add MarkdownEditor with live preview"
```

---

### Task 20: Make the right panel permanent and add `Doc` tab

**Files:**
- Modify: `src/views/EditorView.tsx`

- [ ] **Step 1: Update tab type and add `doc` tab to `TABS`**

At the top of `src/views/EditorView.tsx`:

```typescript
type Tab = 'doc' | 'style' | 'code' | 'ai' | 'metadata';

const TABS: { id: Tab; label: string }[] = [
  { id: 'doc', label: 'Doc' },
  { id: 'style', label: 'Style' },
  { id: 'code', label: 'Code' },
  { id: 'ai', label: 'AI' },
  { id: 'metadata', label: 'Metadata' },
];
```

Update the `useState` initial value:

```typescript
  const [tab, setTab] = useState<Tab>('doc');
```

- [ ] **Step 2: Auto-switch tab on element selection / deselection**

Find the existing `onElementSelected` callback (around line 211) and update it to switch to `style`:

```tsx
            onElementSelected={(path, styles) => {
              const merged: Record<string, string> = {};
              for (const [k, v] of Object.entries(styles)) {
                merged[k] = v;
                merged[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
              }
              setSelectedElementPath(path);
              setSelectedElementStyles(merged);
              setTab('style');
            }}
```

In `clearSelection`:

```tsx
  const clearSelection = () => {
    if (selectedElementPath) {
      previewRef.current?.setElementState(selectedElementPath, 'default');
    }
    setSelectedElementPath(null);
    setSelectedElementStyles(null);
    setTab('doc');
  };
```

- [ ] **Step 3: Make the right panel always render**

Change the `{selectedElementPath && (` wrapper around `ResizablePanel` to always render:

```tsx
      <ResizablePanel defaultWidth={480} minWidth={320} maxWidth={720} side="right">
        {/* …header + tabs as today (already match TABS array)… */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {tab === 'doc' && (
            <MarkdownEditor
              filePath={selectedVariant.docPath}
              initialContent={selectedVariant.docContent}
              onSave={async (path, content) => {
                await writeComponentFile(path, content);
              }}
            />
          )}

          {tab === 'style' && (
            selectedElementPath ? (
              <StyleEditor
                tokens={selectedElementStyles ?? localTokens}
                code={selectedVariant.code}
                onTokenChange={handleTokenChange}
                onStateChange={(state) => {
                  if (selectedElementPath) {
                    previewRef.current?.setElementState(selectedElementPath, state);
                  }
                }}
              />
            ) : (
              <EmptyTab message="Select an element in the preview to inspect its styles." />
            )
          )}

          {tab === 'code' && (
            selectedElementPath ? (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--color-fg-muted)', fontFamily: 'var(--font-code)' }}>
                  {selectedVariant.filePath.split('/').pop()}
                </div>
                <div style={{ flex: 1, minHeight: 400 }}>
                  <CodeEditor value={selectedVariant.code} language="typescript" readOnly={false} onChange={() => {}} />
                </div>
              </div>
            ) : (
              <EmptyTab message="Select an element in the preview to view its source." />
            )
          )}

          {tab === 'ai' && (
            selectedElementPath ? (
              <AIGuidanceEditor
                frontmatter={selectedVariant.frontmatter || {}}
                onUpdate={(field, value) => {
                  console.log(`AI guidance: ${field} = ${value}`);
                }}
              />
            ) : (
              <EmptyTab message="Select an element in the preview to edit AI guidance." />
            )
          )}

          {tab === 'metadata' && (
            selectedElementPath && selectedVariant.frontmatter ? (
              /* existing metadata block (unchanged) */
              <MetadataPanel frontmatter={selectedVariant.frontmatter} />
            ) : (
              <EmptyTab message="Select an element in the preview to view metadata." />
            )
          )}
        </div>
      </ResizablePanel>
```

Add the helper components at the bottom of the file:

```tsx
function EmptyTab({ message }: { message: string }) {
  return (
    <div style={{ padding: 24, fontSize: 12, color: 'var(--color-fg-muted)', textAlign: 'center' }}>
      {message}
    </div>
  );
}

function MetadataPanel({ frontmatter }: { frontmatter: any }) {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {frontmatter.name && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-fg-muted)', marginBottom: 4, fontWeight: 600 }}>Name</div>
            <div style={{ fontSize: 13, color: 'var(--color-fg)' }}>{frontmatter.name}</div>
          </div>
        )}
        {frontmatter.description && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-fg-muted)', marginBottom: 4, fontWeight: 600 }}>Description</div>
            <div style={{ fontSize: 13, color: 'var(--color-fg)', lineHeight: 1.5 }}>{frontmatter.description}</div>
          </div>
        )}
        {frontmatter.usage && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-fg-muted)', marginBottom: 4, fontWeight: 600 }}>Usage</div>
            <div style={{ fontSize: 13, color: 'var(--color-fg)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{frontmatter.usage}</div>
          </div>
        )}
      </div>
    </div>
  );
}
```

Add the import for `MarkdownEditor`:

```typescript
import { MarkdownEditor } from '../components/MarkdownEditor';
```

- [ ] **Step 4: Build**

```bash
cd /Users/patrick/Documents/code-projects/saddle && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run and verify visually**

```bash
cd /Users/patrick/Documents/code-projects/saddle && npm run tauri dev
```

Manual checks:
- Right panel always visible (even when no element selected).
- Default tab is `Doc` and shows markdown editor with side-by-side preview.
- Click element in preview → tab auto-switches to Style; existing style editing still works.
- Esc → tab auto-switches back to Doc.
- Edit markdown content, blur → no error in console; reload project → content persisted.

- [ ] **Step 6: Commit**

```bash
cd /Users/patrick/Documents/code-projects/saddle
git add src/views/EditorView.tsx
git commit -m "feat(editor): permanent right panel with Doc tab and auto-switch"
```

---

## Phase 8 — Picker

### Task 21: Build `ManifestPicker` tree skeleton

**Files:**
- Create: `src/components/ManifestPicker.tsx`

- [ ] **Step 1: Write the skeleton**

```tsx
// src/components/ManifestPicker.tsx
import { useEffect, useMemo, useState } from 'react';
import { scanProjectDirectory, type FileInfo } from '../lib/tauri';

export interface PickerProps {
  projectRoot: string;
  existing: { selectedFiles: string[] }; // relative paths already in the manifest
  mode: 'first-load' | 'reconfigure' | 'diff';
  onSave: (selectedRelativeFiles: string[], extensions: string[]) => Promise<void>;
  onCancel: () => void;
}

const DEFAULT_EXTENSIONS = ['.tsx', '.jsx'];
const ALL_EXTENSIONS = ['.tsx', '.jsx', '.ts', '.js'];
const TEST_GLOBS = ['.test.', '.spec.', '.stories.'];

export function ManifestPicker({ projectRoot, existing, mode, onSave, onCancel }: PickerProps) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [scanning, setScanning] = useState(true);
  const [extensions, setExtensions] = useState<string[]>(DEFAULT_EXTENSIONS);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    scanProjectDirectory(projectRoot)
      .then((scan) => {
        if (cancelled) return;
        setFiles(scan);
        // Initial selection: existing manifest's files (re-open) or pre-check defaults (first-load).
        const init = new Set<string>();
        if (mode === 'first-load') {
          for (const f of scan) {
            if (f.is_dir) continue;
            const rel = relativise(f.path, projectRoot);
            if (!DEFAULT_EXTENSIONS.some((e) => rel.endsWith(e))) continue;
            if (TEST_GLOBS.some((g) => rel.includes(g))) continue;
            if (rel.split('/').includes('components')) init.add(rel);
          }
        } else {
          for (const rel of existing.selectedFiles) init.add(rel);
        }
        setSelected(init);
        // Expand any folder that has a checked descendant.
        const exp = new Set<string>();
        for (const rel of init) {
          let p = rel;
          while (p.includes('/')) {
            p = p.slice(0, p.lastIndexOf('/'));
            exp.add(p);
          }
        }
        setExpanded(exp);
      })
      .catch((err) => console.error('scan failed', err))
      .finally(() => { if (!cancelled) setScanning(false); });
    return () => { cancelled = true; };
  }, [projectRoot]);

  const tree = useMemo(() => buildTree(files, projectRoot), [files, projectRoot]);

  const visibleNodes = useMemo(
    () => filterTree(tree, filter, extensions),
    [tree, filter, extensions],
  );

  const toggleFile = (relPath: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(relPath)) next.delete(relPath); else next.add(relPath);
      return next;
    });
  };

  const toggleFolder = (folderRel: string, descendants: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const matching = descendants.filter((d) => extensions.some((e) => d.endsWith(e)));
      const allChecked = matching.length > 0 && matching.every((d) => next.has(d));
      if (allChecked) {
        for (const d of matching) next.delete(d);
      } else {
        for (const d of matching) next.add(d);
      }
      return next;
    });
  };

  const handleSave = async () => {
    await onSave(Array.from(selected), extensions);
  };

  if (scanning) {
    return <div style={modalShellStyle}><div style={modalContentStyle}><h3>Scanning project…</h3></div></div>;
  }

  return (
    <div style={modalShellStyle}>
      <div style={modalContentStyle}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Choose components</div>
          <div style={{ fontSize: 11, color: 'var(--color-fg-muted)' }}>
            Pick the files that should appear in your gallery. Saved to <code>saddle.manifest.json</code> at the project root.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '10px 20px', borderBottom: '1px solid var(--color-border)', alignItems: 'center', fontSize: 11 }}>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter… (matches path, name, variant)"
            style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 11 }}
          />
          <span style={{ color: 'var(--color-fg-muted)' }}>Extensions:</span>
          {ALL_EXTENSIONS.map((ext) => {
            const on = extensions.includes(ext);
            return (
              <button
                key={ext}
                type="button"
                onClick={() => setExtensions((prev) => prev.includes(ext) ? prev.filter((e) => e !== ext) : [...prev, ext])}
                style={{
                  background: on ? 'var(--color-primary)' : '#fff',
                  color: on ? '#fff' : 'var(--color-fg-muted)',
                  border: on ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                  padding: '2px 8px', borderRadius: 10,
                  fontSize: 10, cursor: 'pointer',
                }}
              >
                {ext}
              </button>
            );
          })}
        </div>

        <div style={{ padding: '10px 20px', height: 360, overflow: 'auto', fontFamily: 'ui-monospace, monospace', fontSize: 11, lineHeight: 1.9 }}>
          <TreeNodes
            nodes={visibleNodes}
            depth={0}
            selected={selected}
            expanded={expanded}
            onToggleExpand={(rel) => setExpanded((prev) => {
              const next = new Set(prev);
              if (next.has(rel)) next.delete(rel); else next.add(rel);
              return next;
            })}
            onToggleFile={toggleFile}
            onToggleFolder={toggleFolder}
            extensions={extensions}
            mode={mode}
            existingFiles={new Set(existing.selectedFiles)}
          />
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
          <div style={{ fontSize: 11, color: 'var(--color-fg-muted)' }}>
            {summarise(selected, files, projectRoot)}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onCancel} style={cancelButtonStyle}>Cancel</button>
            <button onClick={handleSave} style={primaryButtonStyle}>Save manifest</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- helpers ----

function relativise(absolute: string, root: string): string {
  const a = absolute.replace(/\\/g, '/');
  const r = root.replace(/\\/g, '/');
  return a.startsWith(r) ? a.slice(r.length).replace(/^\/+/, '') : a;
}

interface TreeNode {
  rel: string;
  name: string;
  isDir: boolean;
  children: TreeNode[];
}

function buildTree(files: FileInfo[], root: string): TreeNode[] {
  const byRel = new Map<string, TreeNode>();
  for (const f of files) {
    const rel = relativise(f.path, root);
    if (!rel) continue;
    byRel.set(rel, { rel, name: rel.split('/').pop() ?? rel, isDir: f.is_dir, children: [] });
  }
  // Build parent links
  const roots: TreeNode[] = [];
  for (const node of byRel.values()) {
    const parentRel = node.rel.includes('/') ? node.rel.slice(0, node.rel.lastIndexOf('/')) : '';
    if (!parentRel) {
      roots.push(node);
      continue;
    }
    const parent = byRel.get(parentRel);
    if (parent) parent.children.push(node); else roots.push(node);
  }
  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
    for (const n of nodes) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

function filterTree(nodes: TreeNode[], filter: string, extensions: string[]): TreeNode[] {
  const q = filter.trim().toLowerCase();
  const matchesExt = (n: TreeNode) =>
    n.isDir || extensions.some((e) => n.rel.endsWith(e));
  const matchesFilter = (n: TreeNode) =>
    !q || n.rel.toLowerCase().includes(q);
  const recur = (input: TreeNode[]): TreeNode[] => {
    const out: TreeNode[] = [];
    for (const n of input) {
      if (n.isDir) {
        const kids = recur(n.children);
        const keep = kids.length > 0 || (matchesFilter(n) && matchesExt(n));
        if (keep) out.push({ ...n, children: kids });
      } else if (matchesExt(n) && matchesFilter(n)) {
        out.push(n);
      }
    }
    return out;
  };
  return recur(nodes);
}

function summarise(selected: Set<string>, files: FileInfo[], root: string): string {
  const sel = Array.from(selected);
  const compDirs = new Set<string>();
  for (const f of sel) {
    const dir = f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '';
    if (dir) compDirs.add(dir);
  }
  return `${sel.length} variant${sel.length === 1 ? '' : 's'} across ${compDirs.size} component${compDirs.size === 1 ? '' : 's'} selected`;
}

const modalShellStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 200,
  background: 'rgba(0,0,0,0.32)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 24,
};

const modalContentStyle: React.CSSProperties = {
  width: 720, maxWidth: '100%',
  background: '#fff', borderRadius: 12,
  boxShadow: '0 24px 60px rgba(0,0,0,0.22), 0 8px 16px rgba(0,0,0,0.08)',
  display: 'flex', flexDirection: 'column',
};

const cancelButtonStyle: React.CSSProperties = {
  height: 28, padding: '0 14px',
  background: '#fff', border: '1px solid var(--color-border)', borderRadius: 6,
  fontSize: 12, cursor: 'pointer',
};

const primaryButtonStyle: React.CSSProperties = {
  height: 28, padding: '0 14px',
  background: 'var(--color-primary)', color: '#fff',
  border: 'none', borderRadius: 6,
  fontSize: 12, fontWeight: 500, cursor: 'pointer',
};

interface TreeNodesProps {
  nodes: TreeNode[];
  depth: number;
  selected: Set<string>;
  expanded: Set<string>;
  onToggleExpand: (rel: string) => void;
  onToggleFile: (rel: string) => void;
  onToggleFolder: (folderRel: string, descendants: string[]) => void;
  extensions: string[];
  mode: 'first-load' | 'reconfigure' | 'diff';
  existingFiles: Set<string>;
}

function TreeNodes(props: TreeNodesProps) {
  const { nodes, depth, selected, expanded, onToggleExpand, onToggleFile, onToggleFolder, extensions, mode, existingFiles } = props;
  return (
    <>
      {nodes.map((n) => {
        const isExpanded = expanded.has(n.rel);
        if (n.isDir) {
          const descendants = collectFiles(n);
          const matching = descendants.filter((d) => extensions.some((e) => d.endsWith(e)));
          const allChecked = matching.length > 0 && matching.every((d) => selected.has(d));
          const someChecked = matching.some((d) => selected.has(d));
          const state: 'none' | 'partial' | 'all' = allChecked ? 'all' : someChecked ? 'partial' : 'none';
          return (
            <div key={n.rel}>
              <div style={{ paddingLeft: depth * 14 }}>
                <span onClick={() => onToggleExpand(n.rel)} style={{ cursor: 'pointer', color: 'var(--color-primary)' }}>
                  {isExpanded ? '▾' : '▸'}
                </span>{' '}
                <span onClick={() => onToggleFolder(n.rel, descendants)} style={{ cursor: 'pointer' }}>
                  {state === 'all' ? '☑' : state === 'partial' ? '▪' : '☐'}
                </span>{' '}
                📁 {n.name}
              </div>
              {isExpanded && (
                <TreeNodes {...props} nodes={n.children} depth={depth + 1} />
              )}
            </div>
          );
        }
        const isSelected = selected.has(n.rel);
        const isTest = ['.test.', '.spec.', '.stories.'].some((g) => n.rel.includes(g));
        const isNew = mode === 'diff' && !existingFiles.has(n.rel);
        return (
          <div
            key={n.rel}
            onClick={() => onToggleFile(n.rel)}
            style={{ paddingLeft: depth * 14 + 14, cursor: 'pointer', color: isSelected ? 'var(--color-fg)' : 'var(--color-fg-muted)' }}
          >
            <span style={{ color: isSelected ? 'var(--color-primary)' : 'var(--color-fg-muted)' }}>{isSelected ? '☑' : '☐'}</span>{' '}
            {n.name}
            {isTest && <span style={{ color: 'var(--color-fg-muted)', fontFamily: 'var(--font-body)', marginLeft: 6 }}>· test file (auto-skipped)</span>}
            {isNew && <span style={{ color: 'var(--color-success, #16a34a)', marginLeft: 6 }}>●</span>}
          </div>
        );
      })}
    </>
  );
}

function collectFiles(n: TreeNode): string[] {
  if (!n.isDir) return [n.rel];
  return n.children.flatMap(collectFiles);
}
```

- [ ] **Step 2: Build**

```bash
cd /Users/patrick/Documents/code-projects/saddle && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/patrick/Documents/code-projects/saddle
git add src/components/ManifestPicker.tsx
git commit -m "feat(picker): tree-with-checkboxes ManifestPicker"
```

---

### Task 22: Implement save → manifest write

**Files:**
- Modify: `src/components/ManifestPicker.tsx`

The save logic needs to translate the flat `selectedRelativeFiles` list into a structured manifest grouped by parent directory. We'll do this in the call site (Phase 9 wiring). For now, just keep the picker as-is and add a helper that the call site uses.

- [ ] **Step 1: Add the manifest builder helper**

At the bottom of `src/components/ManifestPicker.tsx`, append:

```typescript
import type { Manifest, ManifestComponent, ManifestVariant } from '../types/manifest';

const COMPONENT_NAME_FROM_DIR = (dir: string): string => dir.split('/').pop() ?? dir;

const VARIANT_NAME_FROM_FILE = (componentName: string, fileName: string): string => {
  const base = fileName.replace(/\.(tsx|jsx|ts|js)$/, '');
  if (base === 'index' || base === componentName) return 'Default';
  if (base.startsWith(componentName + '.')) return base.slice(componentName.length + 1);
  return base;
};

const slugify = (input: string): string =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export function buildManifestFromSelections(
  selectedRelative: string[],
  existing: Manifest | null,
): Manifest {
  // Group by parent directory.
  const byDir = new Map<string, string[]>();
  for (const rel of selectedRelative) {
    const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir)!.push(rel);
  }

  const components: ManifestComponent[] = [];
  for (const [dir, files] of byDir) {
    const componentName = COMPONENT_NAME_FROM_DIR(dir);
    const variants: ManifestVariant[] = [];
    for (const fullRel of files) {
      const fileName = fullRel.slice(fullRel.lastIndexOf('/') + 1);
      const variantName = VARIANT_NAME_FROM_FILE(componentName, fileName);
      const docRel = fullRel.replace(/\.(tsx|jsx|ts|js)$/, '.md');

      const existingVariant = existing?.components
        .find((c) => c.directory === dir)?.variants
        .find((v) => v.file === fullRel);

      variants.push({
        id: existingVariant?.id ?? slugify(`${componentName}-${variantName}`),
        name: variantName,
        file: fullRel,
        doc: docRel,
      });
    }

    const existingComponent = existing?.components.find((c) => c.directory === dir);
    components.push({
      id: existingComponent?.id ?? slugify(componentName),
      name: componentName,
      directory: dir,
      variants: variants.sort((a, b) => a.name.localeCompare(b.name)),
    });
  }

  components.sort((a, b) => a.name.localeCompare(b.name));

  return {
    $schema: 'saddle/manifest/v1',
    version: 1,
    components,
  };
}
```

- [ ] **Step 2: Build**

```bash
cd /Users/patrick/Documents/code-projects/saddle && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/patrick/Documents/code-projects/saddle
git add src/components/ManifestPicker.tsx
git commit -m "feat(picker): buildManifestFromSelections helper"
```

---

### Task 23: Replace `ProjectSetupWizard` body with `ManifestPicker`

**Files:**
- Modify: `src/components/ProjectSetupWizard.tsx`

- [ ] **Step 1: Rewrite the wizard**

Replace the entire contents of `src/components/ProjectSetupWizard.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import { ManifestPicker, buildManifestFromSelections } from './ManifestPicker';
import { readManifest, writeManifest } from '../lib/tauri';
import type { Manifest } from '../types/manifest';

interface ProjectSetupWizardProps {
  projectRoot: string;
  mode?: 'first-load' | 'reconfigure' | 'diff';
  onComplete: () => void;
  onCancel: () => void;
}

export function ProjectSetupWizard({ projectRoot, mode = 'first-load', onComplete, onCancel }: ProjectSetupWizardProps) {
  const [existing, setExisting] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    readManifest(projectRoot)
      .then((m) => { if (!cancelled) setExisting(m); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectRoot]);

  if (loading) return null;

  const initialFiles = existing?.components.flatMap((c) => c.variants.map((v) => v.file)) ?? [];

  return (
    <ManifestPicker
      projectRoot={projectRoot}
      mode={existing ? mode : 'first-load'}
      existing={{ selectedFiles: initialFiles }}
      onCancel={onCancel}
      onSave={async (selectedRelative) => {
        const manifest = buildManifestFromSelections(selectedRelative, existing);
        await writeManifest(projectRoot, manifest);
        onComplete();
      }}
    />
  );
}
```

- [ ] **Step 2: Build**

```bash
cd /Users/patrick/Documents/code-projects/saddle && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/patrick/Documents/code-projects/saddle
git add src/components/ProjectSetupWizard.tsx
git commit -m "feat(picker): wire ProjectSetupWizard to ManifestPicker"
```

---

### Task 24: Auto-open the picker on missing manifest

**Files:**
- Modify: `src/views/GalleryView.tsx`

- [ ] **Step 1: Detect missing manifest in `handleLoadProject`**

In `src/views/GalleryView.tsx`, replace `handleLoadProject` with:

```typescript
  const handleLoadProject = async () => {
    try { await killDevServer(); } catch {}
    setDevServerStatus({ kind: 'idle' });
    try {
      const selectedPath = await open({
        directory: true, multiple: false,
        title: 'Select Project Root Directory',
      });

      if (!selectedPath) return;

      setProjectRoot(selectedPath as string);

      // Try to load manifest. If it fails with not_found → open picker.
      try {
        await readManifest(selectedPath as string);
        // Manifest exists; skip wizard, load directly.
        await handleWizardComplete();
      } catch (err: any) {
        if (err?.kind === 'not_found') {
          setShowWizard(true);
        } else {
          // Other manifest errors are surfaced by handleWizardComplete via the
          // full-screen error UI added in Task 28. For now, fall through.
          setShowWizard(true);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open file picker');
    }
  };
```

Add the import for `readManifest`:

```typescript
import { ..., readManifest } from '../lib/tauri';
```

- [ ] **Step 2: Build**

```bash
cd /Users/patrick/Documents/code-projects/saddle && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run app and test full flow**

```bash
cd /Users/patrick/Documents/code-projects/saddle && npm run tauri dev
```

Manual checks:
- Pick a project with no manifest → picker opens with default selections.
- Save → manifest written, components load.
- Pick a project with a manifest → picker doesn't open; components load directly.

- [ ] **Step 4: Commit**

```bash
cd /Users/patrick/Documents/code-projects/saddle
git add src/views/GalleryView.tsx
git commit -m "feat(picker): auto-open picker when manifest missing"
```

---

## Phase 9 — Drift watcher

### Task 25: Emit `manifest-drift` events from the file watcher

**Files:**
- Modify: `src-tauri/src/file_watcher.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Extend `start_watching` with manifest awareness**

Replace `src-tauri/src/file_watcher.rs` with:

```rust
use notify::{Watcher, RecursiveMode, Event, EventKind};
use std::collections::HashSet;
use std::path::Path;
use std::sync::mpsc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

use crate::manifest;

pub fn start_watching(app_handle: AppHandle, path: String) -> Result<(), String> {
    std::thread::spawn(move || {
        let (tx, rx) = mpsc::channel::<notify::Result<Event>>();

        let mut watcher = match notify::recommended_watcher(tx) {
            Ok(w) => w,
            Err(e) => {
                let _ = app_handle.emit("file-watch-error", format!("init: {}", e));
                return;
            }
        };

        if let Err(e) = watcher.watch(Path::new(&path), RecursiveMode::Recursive) {
            let _ = app_handle.emit("file-watch-error", format!("watch: {}", e));
            return;
        }

        // Buffer drift changes for debounce.
        let mut pending_added: HashSet<String> = HashSet::new();
        let mut pending_removed: HashSet<String> = HashSet::new();
        let mut last_change: Option<Instant> = None;
        let debounce = Duration::from_millis(400);

        loop {
            match rx.recv_timeout(Duration::from_millis(100)) {
                Ok(Ok(event)) => {
                    let paths: Vec<String> = event.paths.iter().map(|p| p.to_string_lossy().to_string()).collect();
                    let _ = app_handle.emit("file-changed", serde_json::json!({
                        "paths": paths,
                        "kind": format!("{:?}", event.kind),
                    }));
                    match event.kind {
                        EventKind::Create(_) => {
                            if let Some(rels) = filter_tracked(&paths, &path) {
                                pending_added.extend(rels);
                                last_change = Some(Instant::now());
                            }
                        }
                        EventKind::Remove(_) => {
                            if let Some(rels) = filter_tracked(&paths, &path) {
                                pending_removed.extend(rels);
                                last_change = Some(Instant::now());
                            }
                        }
                        _ => {}
                    }
                }
                Ok(Err(e)) => {
                    let _ = app_handle.emit("file-watch-error", format!("{}", e));
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    // Check debounce.
                    if let Some(t) = last_change {
                        if t.elapsed() >= debounce {
                            emit_drift(&app_handle, &path, &pending_added, &pending_removed);
                            pending_added.clear();
                            pending_removed.clear();
                            last_change = None;
                        }
                    }
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
    });

    Ok(())
}

fn filter_tracked(paths: &[String], project_root: &str) -> Option<Vec<String>> {
    let manifest = manifest::read_manifest_from_disk(Path::new(project_root)).ok()?;
    let dirs: Vec<String> = manifest.components.iter().map(|c| format!("{}/{}", project_root.trim_end_matches('/'), c.directory)).collect();
    let extensions = [".tsx", ".jsx", ".ts", ".js"];
    let mut keep = Vec::new();
    for p in paths {
        let normalised = p.replace('\\', "/");
        if dirs.iter().any(|d| normalised.starts_with(d)) && extensions.iter().any(|e| normalised.ends_with(e)) {
            let rel = normalised.trim_start_matches(&format!("{}/", project_root.trim_end_matches('/'))).to_string();
            keep.push(rel);
        }
    }
    if keep.is_empty() { None } else { Some(keep) }
}

fn emit_drift(app: &AppHandle, project_root: &str, added: &HashSet<String>, removed: &HashSet<String>) {
    if added.is_empty() && removed.is_empty() { return; }
    let manifest_files: HashSet<String> = match manifest::read_manifest_from_disk(Path::new(project_root)) {
        Ok(m) => m.components.iter().flat_map(|c| c.variants.iter().map(|v| v.file.clone())).collect(),
        Err(_) => HashSet::new(),
    };

    let added: Vec<&String> = added.iter().filter(|a| !manifest_files.contains(*a)).collect();
    let removed: Vec<&String> = removed.iter().filter(|r| manifest_files.contains(*r)).collect();

    let _ = app.emit("manifest-drift", serde_json::json!({
        "added": added,
        "removed": removed,
    }));
}
```

- [ ] **Step 2: Build**

```bash
cd /Users/patrick/Documents/code-projects/saddle && cargo build --manifest-path src-tauri/Cargo.toml
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /Users/patrick/Documents/code-projects/saddle
git add src-tauri/src/file_watcher.rs
git commit -m "feat(watcher): emit manifest-drift events"
```

---

### Task 26: Build `DriftPill` and listen for drift events

**Files:**
- Create: `src/components/DriftPill.tsx`
- Modify: `src/views/GalleryView.tsx`
- Modify: `src/views/EditorView.tsx`

- [ ] **Step 1: Build the pill**

```tsx
// src/components/DriftPill.tsx
interface DriftPillProps {
  added: number;
  removed: number;
  onClick: () => void;
}

export function DriftPill({ added, removed, onClick }: DriftPillProps) {
  if (added === 0 && removed === 0) return null;
  const parts: string[] = [];
  if (added > 0) parts.push(`+${added} new file${added === 1 ? '' : 's'}`);
  if (removed > 0) parts.push(`${removed} missing file${removed === 1 ? '' : 's'}`);
  return (
    <button
      onClick={onClick}
      style={{
        background: '#fef7e6',
        border: '1px solid #f5d27a',
        color: '#7a5b08',
        padding: '2px 8px', borderRadius: 10,
        fontSize: 10, cursor: 'pointer',
      }}
    >
      {parts.join(' · ')}
    </button>
  );
}
```

- [ ] **Step 2: Listen for drift in `GalleryView` and lift state**

In `src/views/GalleryView.tsx`, add state and a listener:

```typescript
  const [drift, setDrift] = useState<{ added: string[]; removed: string[] }>({ added: [], removed: [] });

  useEffect(() => {
    const unlisten = listen<{ added: string[]; removed: string[] }>('manifest-drift', (event) => {
      setDrift(event.payload);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);
```

Pass it through to EditorView:

```tsx
        <EditorView
          components={project.components}
          component={selectedComponent}
          onSelectComponent={(comp) => setSelectedComponent(comp)}
          onBack={() => setSelectedComponent(null)}
          devServerUrl={devServerUrl || undefined}
          driftAdded={drift.added.length}
          driftRemoved={drift.removed.length}
          onOpenPicker={() => setShowWizard(true)}
        />
```

- [ ] **Step 3: Render the pill in `EditorView`**

In `src/views/EditorView.tsx`, update props and render:

```typescript
interface EditorViewProps {
  components: Component[];
  component: Component;
  onSelectComponent: (component: Component) => void;
  onBack: () => void;
  devServerUrl?: string;
  driftAdded: number;
  driftRemoved: number;
  onOpenPicker: () => void;
}
```

In the header row added in Task 17, append the `DriftPill` after the existing `ComponentDropdown`:

```tsx
        <div style={{ height: 38, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--color-border)', background: '#fff', flexShrink: 0 }}>
          <ComponentDropdown
            components={components}
            selectedComponent={component}
            selectedVariant={selectedVariant}
            onSelect={(comp, variant) => {
              onSelectComponent(comp);
              const idx = comp.variants.findIndex((v) => v.filePath === variant.filePath);
              if (idx >= 0) setSelectedVariantIndex(idx);
            }}
          />
          <DriftPill added={driftAdded} removed={driftRemoved} onClick={onOpenPicker} />
        </div>
```

Add the import:

```typescript
import { DriftPill } from '../components/DriftPill';
```

- [ ] **Step 4: Build**

```bash
cd /Users/patrick/Documents/code-projects/saddle && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run and verify**

```bash
cd /Users/patrick/Documents/code-projects/saddle && npm run tauri dev
```

Manual: with a project loaded, in another terminal create a new `.tsx` in a tracked component dir → drift pill appears within ~500 ms.

- [ ] **Step 6: Commit**

```bash
cd /Users/patrick/Documents/code-projects/saddle
git add src/components/DriftPill.tsx src/views/GalleryView.tsx src/views/EditorView.tsx
git commit -m "feat(drift): drift pill + manifest-drift event handling"
```

---

## Phase 10 — Error states

### Task 27: Manifest error UI

**Files:**
- Modify: `src/views/GalleryView.tsx`

- [ ] **Step 1: Capture manifest errors and render full-screen error UI**

In `src/views/GalleryView.tsx`, add state:

```typescript
  const [manifestError, setManifestError] = useState<{ kind: string; message?: string; version?: number; path?: string } | null>(null);
```

Wrap the `readManifest` call in `handleLoadProject` (Task 24) to capture the error:

```typescript
      try {
        await readManifest(selectedPath as string);
        await handleWizardComplete();
      } catch (err: any) {
        if (err?.kind === 'not_found') {
          setShowWizard(true);
        } else if (err?.kind === 'invalid_json' || err?.kind === 'unsupported_version' || err?.kind === 'validation_error') {
          setManifestError(err);
        } else {
          setError(`Manifest read failed: ${JSON.stringify(err)}`);
        }
      }
```

In `renderMainContent`, before the `if (loading)` block, add:

```tsx
    if (manifestError) {
      return <ManifestErrorScreen
        error={manifestError}
        projectRoot={projectRoot}
        onResetAndRePick={async () => {
          // Archive the bad file
          const ts = Math.floor(Date.now() / 1000);
          // We don't have a Rust command for "archive"; use writeManifest after a backup read.
          // Simplest: read raw via read_component_file, write to backup, then open picker.
          try {
            const raw = await readComponentFile(`${projectRoot}/saddle.manifest.json`);
            await writeComponentFile(`${projectRoot}/saddle.manifest.json.bak-${ts}`, raw);
            // Now delete the original by writing an empty manifest? No — just ignore and let the picker overwrite.
          } catch {}
          setManifestError(null);
          setShowWizard(true);
        }}
        onOpenInEditor={() => {
          // Tauri opens the file in the system editor.
          import('@tauri-apps/plugin-opener').then(({ openPath }) =>
            openPath(`${projectRoot}/saddle.manifest.json`)
          );
        }}
      />;
    }
```

Add `ManifestErrorScreen` at the bottom of `GalleryView.tsx`:

```tsx
interface ManifestErrorScreenProps {
  error: { kind: string; message?: string; version?: number };
  projectRoot: string;
  onResetAndRePick: () => Promise<void> | void;
  onOpenInEditor: () => void;
}

function ManifestErrorScreen({ error, projectRoot, onResetAndRePick, onOpenInEditor }: ManifestErrorScreenProps) {
  let title = 'Manifest error';
  let body = '';
  let allowReset = true;
  if (error.kind === 'invalid_json') {
    title = 'Manifest is not valid JSON';
    body = `Manifest at ${projectRoot}/saddle.manifest.json could not be parsed. ${error.message ?? ''}`;
  } else if (error.kind === 'unsupported_version') {
    title = 'Manifest is from a newer Saddle';
    body = `Manifest version ${error.version} is newer than this Saddle build supports. Upgrade Saddle to continue.`;
    allowReset = false;
  } else if (error.kind === 'validation_error') {
    title = 'Manifest validation failed';
    body = error.message ?? 'Manifest contains invalid data.';
  }
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-stage)' }}>
      <div style={{ maxWidth: 520, textAlign: 'center', padding: 24 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--color-danger)' }}>{title}</h2>
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--color-fg-muted)', lineHeight: 1.5 }}>{body}</p>
        <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={onOpenInEditor} style={{ height: 30, padding: '0 14px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Open in editor</button>
          {allowReset && (
            <button onClick={onResetAndRePick} style={{ height: 30, padding: '0 14px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Reset and re-pick</button>
          )}
        </div>
      </div>
    </div>
  );
}
```

Add necessary imports at the top of `src/views/GalleryView.tsx`:

```typescript
import { readManifest, readComponentFile, writeComponentFile } from '../lib/tauri';
```

- [ ] **Step 2: Build**

```bash
cd /Users/patrick/Documents/code-projects/saddle && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual test**

Hand-corrupt a fixture's `saddle.manifest.json` (replace contents with `{` ); reload project → full-screen error appears with two buttons.
Set `version` to `99` → error shows without "Reset and re-pick".

- [ ] **Step 4: Commit**

```bash
cd /Users/patrick/Documents/code-projects/saddle
git add src/views/GalleryView.tsx
git commit -m "feat(error): manifest error screens (invalid JSON, unsupported version)"
```

---

### Task 28: Missing-file state in dropdown and preview

**Files:**
- Modify: `src/components/ComponentDropdown.tsx`
- Modify: `src/views/EditorView.tsx`

- [ ] **Step 1: Tag missing variants in `ComponentVariant`**

A variant is "missing" when its `code` is empty AND its `frontmatter` is null AND `loadProject` failed to read it. The cleanest signal is to add a `missing` flag.

In `src/types/component.ts`:

```typescript
export interface ComponentVariant {
  filePath: string;
  variantName: string;
  frontmatter: ComponentFrontmatter | null;
  code: string;
  docPath: string;
  docContent: string;
  missing?: boolean;
}
```

In `src/lib/tauri.ts`, in the rewritten `loadProject`, set `missing: true` when the read failed:

```typescript
      let parsed: { frontmatter: any; code: string } = { frontmatter: null, code: '' };
      let missing = false;
      try {
        const tsxContent = await readComponentFile(fullFilePath);
        parsed = await parseComponentFile(tsxContent);
      } catch (err) {
        console.warn(`Variant file missing or unreadable: ${fullFilePath}`, err);
        missing = true;
      }
      // ...
      variants.push({
        filePath: fullFilePath,
        variantName: mv.name,
        frontmatter: parsed.frontmatter,
        code: parsed.code,
        docPath: fullDocPath,
        docContent,
        missing,
      });
```

- [ ] **Step 2: Strikethrough + warning in dropdown**

In `src/components/ComponentDropdown.tsx`, in the variant button render, conditionally style:

```tsx
                  <button
                    key={v.filePath}
                    type="button"
                    onClick={() => { onSelect(c, v); setOpen(false); setFilter(''); }}
                    style={{
                      ...
                      textDecoration: v.missing ? 'line-through' : 'none',
                      color: v.missing ? 'var(--color-danger)' : 'var(--color-fg)',
                    }}
                  >
                    {v.variantName}{v.missing && ' ⚠'}
                  </button>
```

- [ ] **Step 3: Preview shows error when variant is missing**

In `src/views/EditorView.tsx`, replace the `<ComponentPreview … />` element (the existing JSX block that renders the iframe — keep the existing `ref`, `code`, `frontmatter`, etc. props verbatim in the else branch) with a conditional:

```tsx
        {selectedVariant.missing ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--color-fg-muted)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-danger)' }}>File not found</div>
            <div style={{ fontSize: 12 }}>{selectedVariant.filePath}</div>
            <button
              onClick={onOpenPicker}
              style={{ height: 28, padding: '0 14px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
            >
              Open picker to remove
            </button>
          </div>
        ) : (
          /* Keep the existing ComponentPreview render exactly as it was — same props, same handlers. */
          <ComponentPreview
            ref={previewRef}
            code={selectedVariant.code}
            frontmatter={selectedVariant.frontmatter}
            liveTokens={localTokens}
            devServerUrl={devServerUrl}
            componentName={component.name}
            selectedPath={selectedElementPath}
            onCanvasClick={clearSelection}
            onNewVariant={() => {
              setNewVariantName('');
              setNewVariantError(null);
              setNewVariantOpen(true);
            }}
            onElementSelected={(path, styles) => {
              const merged: Record<string, string> = {};
              for (const [k, v] of Object.entries(styles)) {
                merged[k] = v;
                merged[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
              }
              setSelectedElementPath(path);
              setSelectedElementStyles(merged);
              setTab('style');
            }}
          />
        )}
```

- [ ] **Step 4: Build**

```bash
cd /Users/patrick/Documents/code-projects/saddle && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Manual verify**

Add an entry to a fixture's manifest pointing at a non-existent file → variant shows strikethrough in dropdown; selecting it shows the file-not-found preview.

- [ ] **Step 6: Commit**

```bash
cd /Users/patrick/Documents/code-projects/saddle
git add src/types/component.ts src/lib/tauri.ts src/components/ComponentDropdown.tsx src/views/EditorView.tsx
git commit -m "feat(error): surface missing variant files in dropdown and preview"
```

---

### Task 29: Empty-manifest state

**Files:**
- Modify: `src/views/GalleryView.tsx`

- [ ] **Step 1: Render empty state when manifest has no components**

In `src/views/GalleryView.tsx`, in `renderMainContent`, after the `if (!project)` block:

```tsx
    if (project.components.length === 0) {
      return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-stage)' }}>
          <div style={{ textAlign: 'center', maxWidth: 360 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--color-fg)' }}>No components in manifest</h2>
            <p style={{ margin: '8px 0 16px', fontSize: 13, color: 'var(--color-fg-muted)' }}>Open the picker to add components to your gallery.</p>
            <button
              onClick={() => setShowWizard(true)}
              style={{ height: 32, padding: '0 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            >
              Open picker
            </button>
          </div>
        </div>
      );
    }
```

- [ ] **Step 2: Build**

```bash
cd /Users/patrick/Documents/code-projects/saddle && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/patrick/Documents/code-projects/saddle
git add src/views/GalleryView.tsx
git commit -m "feat(error): empty manifest state with picker entry"
```

---

## Phase 11 — Smoke checklist + final commit

### Task 30: Write the smoke checklist doc

**Files:**
- Create: `docs/superpowers/specs/2026-05-02-component-manifest-and-editor-redesign-smoke.md`

- [ ] **Step 1: Write the document**

```markdown
# Smoke checklist — component manifest & editor redesign

Run through this list against a real project (e.g. `~/saddle-test`) before merging the implementation. Each item should pass.

| # | Step | Expected |
|---|---|---|
| 1 | Fresh project with no `saddle.manifest.json` → Load Project | Picker opens automatically with default selections (files inside `components` folders, test/spec/stories unchecked). |
| 2 | In picker, save manifest | Modal closes; `saddle.manifest.json` exists at project root; dropdown populates with chosen components. |
| 3 | Existing project with manifest → Load Project | No picker. Components render directly. |
| 4 | Click variant in dropdown | Preview reloads; markdown panel shows that variant's `.md` (auto-creates if missing). |
| 5 | Edit `.md` content, click outside the panel | After ~600 ms or on blur, `.md` file on disk reflects the change. |
| 6 | Reload the project | Markdown content persists. |
| 7 | Click an element in the preview | Right panel auto-switches to Style tab; existing token-edit behaviour intact. |
| 8 | Press Esc / click empty canvas | Active tab returns to Doc. |
| 9 | While running, `git checkout` a branch that adds a `.tsx` in a tracked component dir | Drift pill `+1 new file` appears within ~500 ms. |
| 10 | Click drift pill | Picker opens with the new file flagged green and unselected; existing selections preserved. |
| 11 | Same with deleting a tracked file | `1 missing file` pill; picker shows entry struck-through. |
| 12 | Hand-edit `saddle.manifest.json` to reorder variants | Watcher reloads; dropdown reflects new order. |
| 13 | Hand-corrupt manifest (e.g. replace with `{`) | Full-screen error: "Manifest is not valid JSON" with **Open in editor** + **Reset and re-pick**. |
| 14 | Set manifest `version` to `99` | Full-screen error: "Manifest is from a newer Saddle" with only **Open in editor**. |
| 15 | Add a manifest entry pointing at a non-existent `.tsx` | Variant shows strikethrough in dropdown; selecting it shows file-not-found state with "Open picker to remove" action. |
| 16 | Empty manifest (`components: []`) | Empty-state with "Open picker" button. |
| 17 | Open picker via sidebar footer "Configure components…" | Picker opens with current manifest pre-selected. |
| 18 | All Phase 1 Rust tests pass | `cargo test --manifest-path src-tauri/Cargo.toml --lib manifest` shows all green. |
```

- [ ] **Step 2: Commit**

```bash
cd /Users/patrick/Documents/code-projects/saddle
git add docs/superpowers/specs/2026-05-02-component-manifest-and-editor-redesign-smoke.md
git commit -m "docs(smoke): manual smoke checklist for manifest+editor redesign"
```

---

### Task 31: Run the full smoke checklist

**Files:** none (verification only)

- [ ] **Step 1: Run the entire checklist** in `docs/superpowers/specs/2026-05-02-component-manifest-and-editor-redesign-smoke.md` against the dev environment. Mark any failures.

- [ ] **Step 2: Fix any failures discovered.** Each fix should be a separate commit on top of this implementation, referencing the smoke item it resolves.

- [ ] **Step 3: When all 18 items pass, the implementation is complete.** No additional commit; the task is the verification itself.

---

## Self-Review Notes (record only)

Spec coverage check:

| Spec section | Implementing task(s) |
|---|---|
| §1 Goals / non-goals | Whole plan |
| §2 Architecture | Tasks 9, 12, 17, 20, 25 |
| §3 Manifest schema | Tasks 3-6 |
| §3.3 Atomic write, ID preservation | Tasks 7, 9, 22 |
| §4 Picker (tree, filters, defaults, save, entry points) | Tasks 21, 22, 23, 24, 26 |
| §4.4 Diff mode | Task 21 (mode prop), Task 26 (entry from pill) |
| §5 Editor view layout | Tasks 15, 16, 17, 19, 20, 26 |
| §5.4 Doc tab live preview | Tasks 18, 19 |
| §5.5 Sidebar changes | Task 15 |
| §6 Markdown lifecycle | Tasks 8, 12, 19 |
| §6.3 External edits | Task 12 (re-read on event) — note: silent-reload-on-disk-change without unsaved is implicit via `useEffect` reset on `initialContent` change; the unsaved-changes banner is explicitly omitted from v1 to keep scope tight. **Plan deviation logged here.** |
| §7 Error handling | Tasks 27, 28, 29 |
| §8 Backend changes | Tasks 9, 25 |
| §9 Migration | Tasks 12, 14, 24 |
| §10 Testing | Tasks 3-8 (Rust unit), 30 (smoke) |
| §11 Open items | Out of scope (deferred) |

Plan deviation: §6.3's "unsaved changes — reload?" inline banner is **deferred to a follow-up**. The `MarkdownEditor` reloads silently when its `initialContent` prop changes; if a user has unsaved changes when the file changes externally, those changes will be lost on the next save tick. Acceptable for v1 since the externally-edited-while-Saddle-running case is rare and the cost of a reliable banner is meaningful (cross-component event wiring). Captured here so reviewers don't think we forgot.
