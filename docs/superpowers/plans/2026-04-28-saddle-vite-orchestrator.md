# Saddle as a Vite Orchestrator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Saddle spawn the user's Vite dev server itself, auto-inject the bridge as a Vite virtual module, and present a single drop-the-folder workflow — so designers never run `npm run dev` or import `saddle-bridge.js` by hand.

**Architecture:** Saddle generates a `.saddle/` directory inside the user's project containing a wrapper Vite config and a Saddle Vite plugin. The plugin resolves a `virtual:saddle-bridge` module and injects `<script>` tags into the served HTML via `transformIndexHtml`. Saddle spawns Vite as a child process via `tokio::process::Command`, parses the localhost URL from stdout, and stores the child handle in Tauri-managed state for clean shutdown. On project unload or app quit, Saddle kills the child. A new "dev server status pill" in the Settings view replaces the manual URL paste field as the primary affordance; the paste field stays as a fallback when Vite isn't detected.

**Tech Stack:** Tauri 2 (Rust + WebKit) · tokio for async process management · Vite plugin API (virtual modules + `transformIndexHtml`) · React 19 + TypeScript on the frontend.

**Test strategy:** Rust modules are TDD'd with `#[cfg(test)] mod tests`. The frontend has no test infrastructure today and adding it is out of scope for this plan; UI changes use detailed manual verification steps. The end-to-end smoke test runs against `Globex Design system real`.

---

## File Structure

**New files:**
- `src-tauri/src/dev_server.rs` — Vite child process spawn/kill, URL parsing, state container
- `src-tauri/src/saddle_runtime.rs` — generates `.saddle/vite.config.mts` + `.saddle/saddle-plugin.mjs` from string templates; the bridge source is pulled in via `include_str!("../../saddle-bridge.js")` so the plugin always ships the matching protocol

**Modified files:**
- `src-tauri/Cargo.toml` — add `tokio` with `process`, `io-util`, `time`, `sync` features
- `src-tauri/src/lib.rs` — register the new modules, export new commands, manage state
- `src-tauri/src/file_operations.rs` — add `detect_vite_setup` returning Vite presence + paths
- `src/lib/tauri.ts` — add TS wrappers for the four new commands
- `src/views/GalleryView.tsx` — orchestrate spawn/kill on project load, unload, and app exit
- `src/views/DashboardView.tsx` — replace URL paste field with a status pill + retry/manual toggle

**Unchanged but referenced:**
- `saddle-bridge.js` — shared with the existing manual flow; the runtime template `include_str!`s it
- `src/components/ComponentPreview.tsx` — already iframes `devServerUrl`; no change needed

---

## Task 1: Vite + Stories Detection

**Files:**
- Modify: `src-tauri/src/file_operations.rs` — add `detect_vite_setup`
- Modify: `src-tauri/src/lib.rs` — register the new Tauri command
- Modify: `src/lib/tauri.ts` — add `detectViteSetup` wrapper + `ViteSetup` type

- [ ] **Step 1: Write the failing Rust test**

Append to `src-tauri/src/file_operations.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn write(dir: &std::path::Path, rel: &str, contents: &str) {
        let full = dir.join(rel);
        fs::create_dir_all(full.parent().unwrap()).unwrap();
        fs::write(full, contents).unwrap();
    }

    #[test]
    fn detect_vite_in_dev_dependencies() {
        let tmp = TempDir::new().unwrap();
        write(tmp.path(), "package.json", r#"{
            "scripts": { "dev": "vite" },
            "devDependencies": { "vite": "^5.0.0" }
        }"#);
        write(tmp.path(), "vite.config.ts", "export default {};");
        write(tmp.path(), "demo/stories.tsx", "export const stories = [];");

        let setup = detect_vite_setup(tmp.path().to_str().unwrap()).unwrap();
        assert!(setup.has_vite);
        assert_eq!(setup.dev_script.as_deref(), Some("vite"));
        assert!(setup.vite_config_path.unwrap().ends_with("vite.config.ts"));
        assert!(setup.stories_path.unwrap().ends_with("demo/stories.tsx"));
    }

    #[test]
    fn detect_no_vite_when_missing() {
        let tmp = TempDir::new().unwrap();
        write(tmp.path(), "package.json", r#"{ "name": "x" }"#);
        let setup = detect_vite_setup(tmp.path().to_str().unwrap()).unwrap();
        assert!(!setup.has_vite);
        assert!(setup.vite_config_path.is_none());
    }

    #[test]
    fn finds_stories_file_glob() {
        let tmp = TempDir::new().unwrap();
        write(tmp.path(), "package.json", r#"{ "devDependencies": { "vite": "^5" } }"#);
        write(tmp.path(), "vite.config.ts", "");
        write(tmp.path(), "src/Button.stories.tsx", "");
        let setup = detect_vite_setup(tmp.path().to_str().unwrap()).unwrap();
        assert!(setup.stories_path.unwrap().ends_with("Button.stories.tsx"));
    }
}
```

Add `tempfile = "3"` under `[dev-dependencies]` in `src-tauri/Cargo.toml`:

```toml
[dev-dependencies]
tempfile = "3"
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd src-tauri && cargo test --lib detect_vite`
Expected: 3 errors, all "cannot find function `detect_vite_setup`"

- [ ] **Step 3: Implement `detect_vite_setup`**

Append to `src-tauri/src/file_operations.rs` (before the test module):

```rust
#[derive(serde::Serialize, Debug)]
pub struct ViteSetup {
    pub has_vite: bool,
    pub vite_config_path: Option<String>,
    pub stories_path: Option<String>,
    pub dev_script: Option<String>,
}

pub fn detect_vite_setup(project_root: &str) -> Result<ViteSetup, String> {
    let root = std::path::Path::new(project_root);
    let pkg_path = root.join("package.json");

    let pkg_json: serde_json::Value = match std::fs::read_to_string(&pkg_path) {
        Ok(s) => serde_json::from_str(&s).map_err(|e| format!("package.json parse: {e}"))?,
        Err(_) => {
            return Ok(ViteSetup { has_vite: false, vite_config_path: None, stories_path: None, dev_script: None });
        }
    };

    let has_vite = ["dependencies", "devDependencies", "peerDependencies"]
        .iter()
        .any(|k| pkg_json.get(k).and_then(|v| v.get("vite")).is_some());

    let dev_script = pkg_json
        .get("scripts")
        .and_then(|s| s.get("dev"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // Vite config: first match wins
    let vite_config_path = ["vite.config.ts", "vite.config.mts", "vite.config.js", "vite.config.mjs", "vite.config.cjs"]
        .iter()
        .map(|name| root.join(name))
        .find(|p| p.exists())
        .map(|p| p.to_string_lossy().into_owned());

    // Stories file: ordered heuristics
    let stories_path = find_stories_file(root);

    Ok(ViteSetup { has_vite, vite_config_path, stories_path, dev_script })
}

fn find_stories_file(root: &std::path::Path) -> Option<String> {
    // Priority 1: demo/stories.tsx
    let demo_stories = root.join("demo/stories.tsx");
    if demo_stories.exists() {
        return Some(demo_stories.to_string_lossy().into_owned());
    }
    // Priority 2: any *.stories.tsx (depth-limited walk to skip node_modules etc.)
    for entry in walkdir::WalkDir::new(root)
        .max_depth(5)
        .into_iter()
        .filter_entry(|e| {
            if e.depth() == 0 { return true; }
            let name = e.file_name().to_string_lossy();
            !(name.starts_with('.') || name == "node_modules" || name == "dist" || name == "build")
        })
        .filter_map(|e| e.ok())
    {
        let name = entry.file_name().to_string_lossy();
        if name.ends_with(".stories.tsx") {
            return Some(entry.path().to_string_lossy().into_owned());
        }
    }
    // Priority 3: demo/App.tsx (assumed to handle hash routing)
    let demo_app = root.join("demo/App.tsx");
    if demo_app.exists() {
        return Some(demo_app.to_string_lossy().into_owned());
    }
    None
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd src-tauri && cargo test --lib detect_vite`
Expected: 3 passed.

- [ ] **Step 5: Register the Tauri command**

Modify `src-tauri/src/lib.rs`. Find the `use file_operations::{...}` line and add `detect_vite_setup, ViteSetup`:

```rust
use file_operations::{scan_directory, read_file, update_component_tokens, FileInfo, detect_vite_setup, ViteSetup};
```

Add a command function near the other `#[tauri::command]`s (suggested: right after `scan_project_directory`):

```rust
#[tauri::command]
fn detect_vite(project_root: String) -> Result<ViteSetup, String> {
    detect_vite_setup(&project_root)
}
```

In the `tauri::generate_handler![...]` invocation at the bottom of `lib.rs`, add `detect_vite` to the list.

- [ ] **Step 6: Add the TS wrapper**

Modify `src/lib/tauri.ts`. After the existing `FileInfo` interface, add:

```ts
export interface ViteSetup {
  has_vite: boolean;
  vite_config_path: string | null;
  stories_path: string | null;
  dev_script: string | null;
}

export async function detectViteSetup(projectRoot: string): Promise<ViteSetup> {
  return invoke<ViteSetup>('detect_vite', { projectRoot });
}
```

- [ ] **Step 7: Verify the binary still builds**

Run: `cd src-tauri && cargo check`
Expected: success, no errors.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/file_operations.rs src-tauri/src/lib.rs src/lib/tauri.ts
git commit -m "feat(tauri): detect Vite + stories file in project root"
```

---

## Task 2: Generate `.saddle/` runtime files

**Files:**
- Create: `src-tauri/src/saddle_runtime.rs` — template strings + writer
- Modify: `src-tauri/src/lib.rs` — register module + new command
- Modify: `src/lib/tauri.ts` — add `writeSaddleRuntime` wrapper

- [ ] **Step 1: Write the failing test**

Create `src-tauri/src/saddle_runtime.rs`:

```rust
use std::path::Path;

const VITE_CONFIG_TEMPLATE: &str = r#"// Generated by Saddle. Do not edit — regenerated on every project load.
import { defineConfig, loadEnv } from 'vite';
import saddlePlugin from './saddle-plugin.mjs';

export default defineConfig(async (env) => {
  let userConfig: any = {};
  try {
    const mod = await import('__USER_CONFIG_IMPORT__');
    const exported = mod.default ?? mod;
    userConfig = typeof exported === 'function' ? await exported(env) : exported;
  } catch (err) {
    console.warn('[saddle] no user vite.config detected; running with empty base config');
  }
  return {
    ...userConfig,
    plugins: [...(userConfig.plugins ?? []), saddlePlugin()],
  };
});
"#;

const SADDLE_PLUGIN_TEMPLATE: &str = r#"// Generated by Saddle. Do not edit — regenerated on every project load.
const VIRTUAL_ID = 'virtual:saddle-bridge';
const RESOLVED_ID = '\0' + VIRTUAL_ID;
const BRIDGE_SOURCE = __BRIDGE_SOURCE__;

export default function saddlePlugin() {
  return {
    name: 'saddle',
    enforce: 'pre',
    resolveId(id) { if (id === VIRTUAL_ID) return RESOLVED_ID; },
    load(id) { if (id === RESOLVED_ID) return BRIDGE_SOURCE; },
    transformIndexHtml(html) {
      return html.replace(
        /<\/head>/i,
        `<script type="module" src="/@id/${VIRTUAL_ID}"></script></head>`
      );
    },
  };
}
"#;

const BRIDGE_SOURCE: &str = include_str!("../../saddle-bridge.js");

pub fn write_saddle_runtime(project_root: &str, vite_config_path: Option<&str>) -> Result<(), String> {
    let root = Path::new(project_root);
    let saddle_dir = root.join(".saddle");
    std::fs::create_dir_all(&saddle_dir).map_err(|e| format!("create .saddle: {e}"))?;

    // vite.config.mts wrapper. Compute the relative import path to the user's config.
    let import_path = match vite_config_path {
        Some(p) => {
            let rel = Path::new(p)
                .strip_prefix(root)
                .map_err(|e| format!("path strip: {e}"))?;
            // Vite imports need a leading ../ from .saddle/
            format!("../{}", rel.display())
        }
        None => "../vite.config.ts".to_string(), // fallback; the import will fail and we log a warning
    };

    let vite_config_contents = VITE_CONFIG_TEMPLATE.replace("__USER_CONFIG_IMPORT__", &import_path);
    std::fs::write(saddle_dir.join("vite.config.mts"), vite_config_contents)
        .map_err(|e| format!("write vite.config.mts: {e}"))?;

    // saddle-plugin.mjs: inline the bridge as a JSON string literal so escaping is correct.
    let bridge_literal = serde_json::to_string(BRIDGE_SOURCE).map_err(|e| format!("encode bridge: {e}"))?;
    let plugin_contents = SADDLE_PLUGIN_TEMPLATE.replace("__BRIDGE_SOURCE__", &bridge_literal);
    std::fs::write(saddle_dir.join("saddle-plugin.mjs"), plugin_contents)
        .map_err(|e| format!("write saddle-plugin.mjs: {e}"))?;

    // .gitignore: append `.saddle/` if not already present. Create file if missing.
    let gitignore = root.join(".gitignore");
    let current = std::fs::read_to_string(&gitignore).unwrap_or_default();
    if !current.lines().any(|l| l.trim() == ".saddle" || l.trim() == ".saddle/") {
        let new_contents = if current.is_empty() {
            ".saddle/\n".to_string()
        } else if current.ends_with('\n') {
            format!("{current}.saddle/\n")
        } else {
            format!("{current}\n.saddle/\n")
        };
        std::fs::write(&gitignore, new_contents).map_err(|e| format!("write .gitignore: {e}"))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn writes_saddle_dir_files() {
        let tmp = TempDir::new().unwrap();
        std::fs::write(tmp.path().join("vite.config.ts"), "export default {};").unwrap();

        write_saddle_runtime(
            tmp.path().to_str().unwrap(),
            Some(tmp.path().join("vite.config.ts").to_str().unwrap()),
        ).unwrap();

        let cfg = std::fs::read_to_string(tmp.path().join(".saddle/vite.config.mts")).unwrap();
        assert!(cfg.contains("../vite.config.ts"));

        let plugin = std::fs::read_to_string(tmp.path().join(".saddle/saddle-plugin.mjs")).unwrap();
        assert!(plugin.contains("virtual:saddle-bridge"));
        // The bridge contents got inlined as a JSON string.
        assert!(plugin.contains("__SADDLE_BRIDGE_INSTALLED__"));
    }

    #[test]
    fn appends_gitignore_idempotently() {
        let tmp = TempDir::new().unwrap();
        std::fs::write(tmp.path().join(".gitignore"), "node_modules\n").unwrap();

        write_saddle_runtime(tmp.path().to_str().unwrap(), None).unwrap();
        write_saddle_runtime(tmp.path().to_str().unwrap(), None).unwrap();

        let gi = std::fs::read_to_string(tmp.path().join(".gitignore")).unwrap();
        let count = gi.lines().filter(|l| l.trim() == ".saddle/").count();
        assert_eq!(count, 1, "should only append once across multiple runs");
    }

    #[test]
    fn creates_gitignore_if_missing() {
        let tmp = TempDir::new().unwrap();
        write_saddle_runtime(tmp.path().to_str().unwrap(), None).unwrap();
        let gi = std::fs::read_to_string(tmp.path().join(".gitignore")).unwrap();
        assert_eq!(gi.trim(), ".saddle/");
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd src-tauri && cargo test --lib saddle_runtime`
Expected: error — `unresolved module saddle_runtime` (mod not declared yet).

- [ ] **Step 3: Declare the module + register the command in `lib.rs`**

In `src-tauri/src/lib.rs`, add `mod saddle_runtime;` near the other module declarations at the top.

Add a Tauri command alongside the others:

```rust
#[tauri::command]
fn write_saddle_runtime_files(project_root: String, vite_config_path: Option<String>) -> Result<(), String> {
    saddle_runtime::write_saddle_runtime(&project_root, vite_config_path.as_deref())
}
```

Add `write_saddle_runtime_files` to the `tauri::generate_handler![...]` list.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd src-tauri && cargo test --lib saddle_runtime`
Expected: 3 passed.

- [ ] **Step 5: Add the TS wrapper**

Modify `src/lib/tauri.ts`. After the `detectViteSetup` export, add:

```ts
export async function writeSaddleRuntime(projectRoot: string, viteConfigPath: string | null): Promise<void> {
  return invoke<void>('write_saddle_runtime_files', { projectRoot, viteConfigPath });
}
```

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/saddle_runtime.rs src-tauri/src/lib.rs src/lib/tauri.ts
git commit -m "feat(tauri): generate .saddle/ runtime files in user project"
```

---

## Task 3: Vite child process management

**Files:**
- Create: `src-tauri/src/dev_server.rs` — spawn / kill / state container
- Modify: `src-tauri/Cargo.toml` — add `tokio` deps
- Modify: `src-tauri/src/lib.rs` — register module, manage state, expose 3 commands

- [ ] **Step 1: Add tokio to Cargo.toml**

Modify `src-tauri/Cargo.toml`. Under `[dependencies]`, add:

```toml
tokio = { version = "1", features = ["process", "io-util", "time", "sync", "rt", "macros"] }
once_cell = "1"
```

(`once_cell` is for a static `Mutex` holding the child handle.)

- [ ] **Step 2: Write the failing test**

Create `src-tauri/src/dev_server.rs`:

```rust
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use once_cell::sync::Lazy;

pub static CURRENT_CHILD: Lazy<Arc<Mutex<Option<Child>>>> = Lazy::new(|| Arc::new(Mutex::new(None)));

pub async fn spawn_vite(project_root: &str) -> Result<String, String> {
    // Kill any previous child so we never leak processes across project switches.
    kill_current().await;

    let mut cmd = Command::new("node");
    cmd.arg("node_modules/vite/bin/vite.js")
        .arg("--config")
        .arg(".saddle/vite.config.mts")
        .current_dir(project_root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    let mut child = cmd.spawn().map_err(|e| format!("failed to spawn node: {e} — is Node installed and on PATH?"))?;
    let stdout = child.stdout.take().ok_or_else(|| "no stdout pipe".to_string())?;

    let url_re = regex::Regex::new(r"http://localhost:\d+").map_err(|e| format!("regex: {e}"))?;
    let mut reader = BufReader::new(stdout).lines();

    // Wait up to 20s for Vite to print a "Local:" URL.
    let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(20);
    let mut url = None;
    while tokio::time::Instant::now() < deadline {
        let remaining = deadline - tokio::time::Instant::now();
        match tokio::time::timeout(remaining, reader.next_line()).await {
            Ok(Ok(Some(line))) => {
                if let Some(m) = url_re.find(&line) {
                    url = Some(m.as_str().to_string());
                    break;
                }
            }
            Ok(Ok(None)) => break,        // stdout closed
            Ok(Err(_)) => break,          // read error
            Err(_) => break,              // timed out
        }
    }

    match url {
        Some(u) => {
            *CURRENT_CHILD.lock().await = Some(child);
            Ok(u)
        }
        None => {
            // Failed to start: kill the half-spawned child and return the error.
            let _ = child.kill().await;
            Err("Vite did not print a Local: URL within 20 seconds — check that node_modules/vite exists and the user's vite.config is valid".to_string())
        }
    }
}

pub async fn kill_current() {
    let mut guard = CURRENT_CHILD.lock().await;
    if let Some(mut child) = guard.take() {
        let _ = child.kill().await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// We can't reliably spawn the user's Vite in CI, but we CAN exercise the
    /// "kill any existing child" path with a long-running `cat` process.
    #[tokio::test]
    async fn kill_current_drops_child() {
        // Inject a fake long-running child.
        let child = Command::new("sleep").arg("60").stdout(Stdio::null()).spawn().unwrap();
        *CURRENT_CHILD.lock().await = Some(child);

        kill_current().await;

        let guard = CURRENT_CHILD.lock().await;
        assert!(guard.is_none(), "child should be cleared after kill");
    }
}
```

- [ ] **Step 3: Declare the module in `lib.rs`**

Add `mod dev_server;` near the other module declarations at the top of `src-tauri/src/lib.rs`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd src-tauri && cargo test --lib dev_server`
Expected: 1 passed (`kill_current_drops_child`).

If `sleep` isn't available on the test host (Windows CI), the test will be skipped naturally because the `Command::new("sleep").spawn()` will error before reaching the assertion. That's fine — we only need this passing on the developer's mac for now.

- [ ] **Step 5: Add Tauri commands for spawn / kill / status**

In `src-tauri/src/lib.rs`, add commands after the others:

```rust
#[tauri::command]
async fn spawn_dev_server(project_root: String) -> Result<String, String> {
    dev_server::spawn_vite(&project_root).await
}

#[tauri::command]
async fn kill_dev_server() -> Result<(), String> {
    dev_server::kill_current().await;
    Ok(())
}
```

Add both names to `tauri::generate_handler![...]`.

- [ ] **Step 6: Wire app-exit cleanup**

Find the `tauri::Builder::default()` block (typically near the end of `lib.rs`'s `pub fn run`). Add a `.on_window_event` handler that kills the child on window close:

```rust
.on_window_event(|_window, event| {
    if let tauri::WindowEvent::CloseRequested { .. } = event {
        // Block briefly to give the child a chance to die cleanly.
        tauri::async_runtime::block_on(async {
            dev_server::kill_current().await;
        });
    }
})
```

- [ ] **Step 7: Verify the binary builds**

Run: `cd src-tauri && cargo check`
Expected: success.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/dev_server.rs src-tauri/src/lib.rs
git commit -m "feat(tauri): spawn/kill Vite as a managed child process"
```

---

## Task 4: Frontend wrappers + Settings UI

**Files:**
- Modify: `src/lib/tauri.ts` — add `spawnDevServer` / `killDevServer` wrappers
- Modify: `src/views/DashboardView.tsx` — replace URL paste with status pill + retry/manual toggle

- [ ] **Step 1: Add the two TS wrappers**

In `src/lib/tauri.ts`, after the `writeSaddleRuntime` export, add:

```ts
export async function spawnDevServer(projectRoot: string): Promise<string> {
  return invoke<string>('spawn_dev_server', { projectRoot });
}

export async function killDevServer(): Promise<void> {
  return invoke<void>('kill_dev_server');
}
```

- [ ] **Step 2: Replace the dev-server card in DashboardView with a status pill**

Open `src/views/DashboardView.tsx`. Find the `Dev Server` card section. Replace its body so it accepts a new prop `devServerStatus` and renders a pill instead of the URL input. The full new card markup (replace the existing `Dev Server` card content with this):

```tsx
{/* Dev Server */}
<Card title="Dev Server">
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
    <div style={statusDot(devServerStatus.kind)} />
    <div style={{ fontSize: 13, color: 'var(--color-fg)' }}>
      {devServerStatus.kind === 'spawning' && 'Spawning Vite…'}
      {devServerStatus.kind === 'live' && (
        <>Live · <code style={{ fontFamily: 'var(--font-code)' }}>{devServerStatus.url}</code></>
      )}
      {devServerStatus.kind === 'failed' && (
        <>Failed: <span style={{ color: 'var(--color-fg-muted)' }}>{devServerStatus.error}</span></>
      )}
      {devServerStatus.kind === 'manual' && 'Connect to your own dev server'}
      {devServerStatus.kind === 'idle' && 'Not started'}
    </div>
    {(devServerStatus.kind === 'failed' || devServerStatus.kind === 'idle') && onRetryDevServer && (
      <button
        onClick={onRetryDevServer}
        style={{
          height: 26, padding: '0 10px',
          background: 'var(--color-fg)', color: '#fff',
          border: 'none', borderRadius: 6,
          fontSize: 12, fontWeight: 500, cursor: 'pointer',
        }}
      >
        Retry
      </button>
    )}
  </div>

  {/* Manual fallback toggle + URL input. Always available. */}
  <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
    <div style={{ fontSize: 12, color: 'var(--color-fg-muted)', marginBottom: 6 }}>
      Or connect to a server you started yourself:
    </div>
    <div style={{ display: 'flex', gap: 6 }}>
      <input
        type="text"
        value={devServerUrl}
        onChange={(e) => setDevServerUrl(e.target.value)}
        placeholder="http://localhost:5173"
        style={{
          flex: 1, height: 28, padding: '0 8px',
          fontSize: 12, fontFamily: 'var(--font-code)',
          border: '1px solid var(--color-border)', borderRadius: 6,
          background: '#fff', color: 'var(--color-fg)', outline: 'none',
        }}
      />
      <button
        onClick={() => checkDevServer(devServerUrl)}
        style={{
          height: 28, padding: '0 12px',
          background: 'transparent', color: 'var(--color-fg)',
          border: '1px solid var(--color-border)', borderRadius: 6,
          fontSize: 12, fontWeight: 500, cursor: 'pointer',
        }}
      >
        Connect
      </button>
    </div>
  </div>
</Card>
```

Update the `DashboardViewProps` interface at the top of the file:

```tsx
export type DevServerStatus =
  | { kind: 'idle' }
  | { kind: 'spawning' }
  | { kind: 'live'; url: string }
  | { kind: 'failed'; error: string }
  | { kind: 'manual' };

interface DashboardViewProps {
  project: ProjectStructure;
  projectRoot: string;
  onDevServerConnect?: (url: string) => void;
  onLoadProject?: () => void;
  devServerStatus: DevServerStatus;
  onRetryDevServer?: () => void;
}
```

Update the destructuring at the top of `export function DashboardView({...})` to include `devServerStatus` and `onRetryDevServer`.

Update `statusDot` to accept the status kind directly:

```tsx
const statusDot = (kind: DevServerStatus['kind']) => ({
  width: 10, height: 10, borderRadius: '50%',
  background:
    kind === 'live' ? 'var(--color-success)' :
    kind === 'spawning' ? 'var(--color-warning)' :
    kind === 'failed' ? 'var(--color-danger)' :
    'var(--color-fg-subtle)',
  flexShrink: 0,
});
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/patrick/Documents/code-projects/saddle && npx tsc --noEmit`
Expected: no errors related to `DashboardView`. Other unrelated `tsc` warnings can be ignored as long as nothing in `src/views/DashboardView.tsx` errors.

- [ ] **Step 4: Manual UI verification**

In a separate terminal (don't restart Tauri yet — Vite HMR will pick up the React change):

1. Open the Saddle window, load any project.
2. Navigate to **Settings**.
3. The Dev Server card should now show a pill ("Not started") with Retry button, and the URL input should sit below a divider labeled "Or connect to a server you started yourself".
4. There should be no console errors in the webview console (right-click → Inspect Element → Console).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tauri.ts src/views/DashboardView.tsx
git commit -m "feat(ui): replace dev server URL input with status pill + manual fallback"
```

---

## Task 5: Orchestrate spawn/kill in GalleryView

**Files:**
- Modify: `src/views/GalleryView.tsx` — call `detectViteSetup` → `writeSaddleRuntime` → `spawnDevServer` after project load

- [ ] **Step 1: Add the orchestrator state + helpers to GalleryView**

Open `src/views/GalleryView.tsx`. Near the top of `GalleryView()`, after the existing `useState` calls, add:

```tsx
import { detectViteSetup, writeSaddleRuntime, spawnDevServer, killDevServer } from '../lib/tauri';
import type { DevServerStatus } from './DashboardView';
```

```tsx
const [devServerStatus, setDevServerStatus] = useState<DevServerStatus>({ kind: 'idle' });

const startSaddleManagedVite = async (root: string) => {
  setDevServerStatus({ kind: 'spawning' });
  try {
    const setup = await detectViteSetup(root);
    if (!setup.has_vite || !setup.stories_path) {
      // Fall back to manual mode — leave dev server URL empty, let the user paste their own.
      setDevServerStatus({ kind: 'manual' });
      addLog('warning', 'Vite or stories file not detected; switch to manual dev server', 'devserver');
      return;
    }
    await writeSaddleRuntime(root, setup.vite_config_path);
    const url = await spawnDevServer(root);
    setDevServerUrl(url);
    setDevServerStatus({ kind: 'live', url });
    addLog('success', `Saddle-managed Vite live on ${url}`, 'devserver');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setDevServerStatus({ kind: 'failed', error: msg });
    addLog('error', `Vite spawn failed: ${msg}`, 'devserver');
  }
};
```

- [ ] **Step 2: Hook startSaddleManagedVite into project load**

Find `handleWizardComplete` in the same file. After the `setProject(loadedProject)` line and the existing `watchProject` block, add:

```tsx
// Auto-start Saddle-managed Vite for this project.
await startSaddleManagedVite(projectRoot);
```

- [ ] **Step 3: Kill the dev server on project switch**

Find `handleLoadProject`. At the very top of the function, before the file picker, add:

```tsx
// Tear down any previous dev server before loading a new project.
try { await killDevServer(); } catch {}
setDevServerStatus({ kind: 'idle' });
```

- [ ] **Step 4: Pass the new props to DashboardView**

Find the `DashboardView` JSX render. Update its props:

```tsx
return (
  <DashboardView
    project={project}
    projectRoot={projectRoot}
    onLoadProject={handleLoadProject}
    devServerStatus={devServerStatus}
    onRetryDevServer={() => startSaddleManagedVite(projectRoot)}
    onDevServerConnect={(url) => {
      setDevServerUrl(url);
      addLog('success', `Connected to dev server: ${url}`, 'devserver');
    }}
  />
);
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd /Users/patrick/Documents/code-projects/saddle && npx tsc --noEmit`
Expected: no errors in `GalleryView.tsx` or `DashboardView.tsx`.

- [ ] **Step 6: Commit**

```bash
git add src/views/GalleryView.tsx
git commit -m "feat(ui): auto-spawn Saddle-managed Vite after project load"
```

---

## Task 6: End-to-end verification against Globex Design system real

This task has no code; it's the smoke test that proves the whole orchestrator works. If any step fails, file the failure as a sub-task back into earlier tasks.

- [ ] **Step 1: Restart the Tauri app to pick up Rust changes**

Stop the current `npm run tauri dev` (Ctrl-C in its terminal). Restart with `cargo` rebuild forced:

```bash
cd /Users/patrick/Documents/code-projects/saddle
rm -rf src-tauri/target/debug/.fingerprint/saddle-app-*
npm run tauri dev
```

Wait for `Running 'target/debug/saddle-app'` in the output.

- [ ] **Step 2: Load Globex Design system real**

In Saddle:

1. Click **Load Project** (or sidebar footer's Settings → Load Different Project).
2. Pick `/Users/patrick/Documents/code-projects/Globex Design system real/`.
3. In the wizard, accept defaults (component path `src/components`, extensions `.tsx`).

Expected:
- Sidebar populates with the 10 Globex components (Button, Badge, Input, Label, Textarea, Separator, Card, Dialog, DropdownMenu, Tooltip).
- Settings → Dev Server card shows status pill cycling: `Not started` → `Spawning Vite…` → `Live · http://localhost:NNNN` within ~5 seconds.

- [ ] **Step 3: Inspect generated `.saddle/`**

In a terminal:

```bash
ls "/Users/patrick/Documents/code-projects/Globex Design system real/.saddle/"
cat "/Users/patrick/Documents/code-projects/Globex Design system real/.saddle/vite.config.mts"
grep -c "saddle" "/Users/patrick/Documents/code-projects/Globex Design system real/.gitignore"
```

Expected:
- `vite.config.mts` and `saddle-plugin.mjs` exist in `.saddle/`
- `vite.config.mts` references `../vite.config.ts`
- `.gitignore` contains exactly one `.saddle/` line

- [ ] **Step 4: Inspect a component**

In Saddle:

1. Click **Button** in the sidebar.
2. The iframe should load showing the Button stories.
3. ⌘ + click on a button → the right inspector should open with the variant header showing `Button · Default` and computed styles populated.

Expected: bridge handshake works without any manual `import './saddle-bridge'` in `demo/main.tsx`. (Confirm by `git diff` in the Globex repo: no edits to `demo/main.tsx`.)

- [ ] **Step 5: Token edit drives HMR**

In Saddle:

1. Settings → ensure status is `Live`.
2. Tokens → Colors → expand `Primary` group → change `bg` from `#2563eb` to `#9333ea`.
3. Switch back to Components → Button.

Expected: button repaints purple within ~500ms (the time for Saddle's postMessage to land + Vite HMR to catch the file write).

- [ ] **Step 6: Project switch cleanup**

In Saddle:

1. Settings → Load Different Project → pick `Globex design system` (the other folder).
2. Watch the status pill: `Live` → `Spawning…` → `Live` on a new port.

In a separate terminal:

```bash
ps aux | grep -E '[v]ite' | wc -l
```

Expected: exactly 1 Vite process (the new one). The old one was killed by the project-switch cleanup hook.

- [ ] **Step 7: App quit cleanup**

Quit Saddle (Cmd+Q on the desktop window).

```bash
ps aux | grep -E '[v]ite' | wc -l
```

Expected: 0. No orphan Vite processes.

- [ ] **Step 8: Fallback path — project without Vite**

In Saddle, load a project without Vite (e.g. `~/Documents/code-projects/saddle/website/` — pure static HTML).

Expected: status pill goes straight to `Manual`. The URL input below the divider is the primary affordance. No `.saddle/` directory is generated in `website/`.

- [ ] **Step 9: Commit a passing run note**

If all the above pass, leave a single-line note in the project journal (or just commit a NOTES file noting the date and "all 8 verification steps passed against Globex"):

```bash
echo "$(date +%Y-%m-%d) Saddle-managed Vite orchestrator: all 8 verification steps passed" >> docs/superpowers/specs/notes.md
git add docs/superpowers/specs/notes.md
git commit -m "test: orchestrator verified end-to-end against Globex"
```

---

## Self-Review Notes (already applied during plan write)

- All Rust functions referenced (`detect_vite_setup`, `write_saddle_runtime`, `spawn_vite`, `kill_current`) are defined exactly once with consistent signatures.
- TS commands (`detect_vite`, `write_saddle_runtime_files`, `spawn_dev_server`, `kill_dev_server`) match the Rust `#[tauri::command]` names with snake_case → kebab-case Tauri default mapping (which is why the JS wrappers explicitly call the snake_case names).
- The bridge file (`saddle-bridge.js`) has `__SADDLE_BRIDGE_INSTALLED__` guard at the top, so embedding it via `include_str!` and a JSON literal preserves it.
- The status pill enum (`DevServerStatus`) is exported from `DashboardView` and consumed by `GalleryView`; types align.
- The `kill_dev_server` is called on three triggers: project switch (`handleLoadProject`), app quit (`on_window_event`), and from the Retry path (implicitly, via `spawn_vite`'s `kill_current().await` at the top).
- No placeholders. Every code step shows the exact code. Every command step shows the exact command and expected output.
