use std::process::Stdio;
use once_cell::sync::Lazy;
use regex::Regex;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

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
