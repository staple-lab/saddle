use std::process::Stdio;
use std::sync::atomic::{AtomicU32, Ordering};
use once_cell::sync::Lazy;
use regex::Regex;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

/// PID of the currently-tracked Vite child, mirrored from `CURRENT_CHILD` for
/// synchronous access from the Tauri exit hook (where we can't await the async
/// mutex). 0 means no child is running.
static CURRENT_PID: AtomicU32 = AtomicU32::new(0);

/// Currently-running Vite child process. Replaced on each successful spawn,
/// cleared by `kill_current`.
static CURRENT_CHILD: Lazy<Mutex<Option<Child>>> = Lazy::new(|| Mutex::new(None));

/// Serializes `spawn_vite` calls so concurrent invocations don't race
/// (both passing the empty-mutex check and both leaving children behind).
static SPAWN_LOCK: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));

/// Lazy-compiled URL regex. The literal is statically valid so this can't fail.
static URL_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"http://localhost:\d+").unwrap());

const STARTUP_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(20);

pub async fn spawn_vite(project_root: &str) -> Result<String, String> {
    // Serialize: only one spawn at a time. Held for the full body.
    let _spawn_guard = SPAWN_LOCK.lock().await;

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

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("failed to spawn node: {e} — is Node installed and on PATH?"))?;

    let stdout = child.stdout.take().ok_or_else(|| "no stdout pipe".to_string())?;
    let stderr = child.stderr.take().ok_or_else(|| "no stderr pipe".to_string())?;

    // Drain stderr concurrently into a buffer so the pipe never fills, and so
    // we can include it in the timeout error message if Vite never prints a URL.
    let stderr_buf = std::sync::Arc::new(Mutex::new(String::new()));
    let stderr_buf_clone = stderr_buf.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let mut buf = stderr_buf_clone.lock().await;
            buf.push_str(&line);
            buf.push('\n');
        }
    });

    let mut reader = BufReader::new(stdout).lines();
    let deadline = tokio::time::Instant::now() + STARTUP_TIMEOUT;
    let mut url = None;
    while tokio::time::Instant::now() < deadline {
        let remaining = deadline - tokio::time::Instant::now();
        match tokio::time::timeout(remaining, reader.next_line()).await {
            Ok(Ok(Some(line))) => {
                if let Some(m) = URL_RE.find(&line) {
                    url = Some(m.as_str().to_string());
                    break;
                }
            }
            Ok(Ok(None)) => break, // stdout closed
            Ok(Err(_)) => break,   // read error
            Err(_) => break,       // timed out
        }
    }

    match url {
        Some(u) => {
            CURRENT_PID.store(child.id().unwrap_or(0), Ordering::SeqCst);
            *CURRENT_CHILD.lock().await = Some(child);
            Ok(u)
        }
        None => {
            let _ = child.kill().await;
            let captured_stderr = stderr_buf.lock().await.clone();
            let stderr_section = if captured_stderr.trim().is_empty() {
                String::new()
            } else {
                format!("\n\nVite stderr:\n{}", captured_stderr.trim())
            };
            Err(format!(
                "Vite did not print a Local: URL within {}s — check that node_modules/vite exists and the user's vite.config is valid.{stderr_section}",
                STARTUP_TIMEOUT.as_secs()
            ))
        }
    }
}

pub async fn kill_current() {
    let mut guard = CURRENT_CHILD.lock().await;
    if let Some(mut child) = guard.take() {
        let _ = child.kill().await;
    }
    CURRENT_PID.store(0, Ordering::SeqCst);
}

/// Synchronously send SIGTERM to the tracked child, by PID. Used from the
/// Tauri exit hook on macOS, where we can't await the async mutex (the runtime
/// is being torn down). No-op if no child is tracked.
#[cfg(unix)]
pub fn kill_current_sync() {
    let pid = CURRENT_PID.swap(0, Ordering::SeqCst);
    if pid == 0 { return; }
    // SAFETY: `kill` with a positive pid and SIGTERM is safe; worst case is
    // ESRCH (child already exited).
    unsafe { libc::kill(pid as i32, libc::SIGTERM); }
}

#[cfg(not(unix))]
pub fn kill_current_sync() {
    // On non-unix platforms, fall back to a no-op; `kill_on_drop(true)` on the
    // tokio Child should still clean up if the runtime tears down cleanly.
    CURRENT_PID.store(0, Ordering::SeqCst);
}

/// Polls `CURRENT_CHILD` until the child stored at call time exits on its own,
/// is replaced by a newer spawn, or is killed via `kill_current`. Returns
/// `true` only when the child died unexpectedly (so the caller can notify the
/// frontend); returns `false` when the child was replaced or killed cleanly,
/// in which case no notification is needed.
pub async fn await_child_exit() -> bool {
    let initial_pid = match CURRENT_CHILD.lock().await.as_ref() {
        Some(c) => match c.id() {
            Some(p) => p,
            None => return false,
        },
        None => return false,
    };
    loop {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        let mut guard = CURRENT_CHILD.lock().await;
        match guard.as_mut() {
            None => return false, // killed externally via kill_current
            Some(child) => {
                if child.id() != Some(initial_pid) {
                    return false; // replaced by a newer spawn
                }
                match child.try_wait() {
                    Ok(Some(_status)) => {
                        *guard = None;
                        return true; // died on its own
                    }
                    Ok(None) => continue,
                    Err(_) => return false,
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Exercise the "kill any existing child" path with a long-running `sleep` process.
    #[tokio::test]
    async fn kill_current_drops_child() {
        let child = Command::new("sleep").arg("60").stdout(Stdio::null()).spawn().unwrap();
        *CURRENT_CHILD.lock().await = Some(child);

        kill_current().await;

        let guard = CURRENT_CHILD.lock().await;
        assert!(guard.is_none(), "child should be cleared after kill");
    }

    #[tokio::test]
    async fn spawn_fails_on_bad_cwd() {
        let result = spawn_vite("/this/path/should/not/exist/xyz/saddle-test").await;
        assert!(result.is_err(), "expected Err for nonexistent cwd, got: {result:?}");
        let msg = result.unwrap_err();
        assert!(
            msg.contains("node") || msg.contains("spawn") || msg.contains("file") || msg.contains("No such"),
            "expected error message to mention node/spawn/file, got: {msg}"
        );
    }
}
