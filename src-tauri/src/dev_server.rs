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
