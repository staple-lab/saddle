use notify::{Watcher, RecursiveMode, Event, EventKind};
use std::sync::mpsc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub fn start_watching(app_handle: AppHandle, path: String) -> Result<(), String> {
    std::thread::spawn(move || {
        let (tx, rx) = mpsc::channel::<notify::Result<Event>>();

        let mut watcher = notify::recommended_watcher(tx)
            .map_err(|e| format!("Watcher init failed: {}", e))
            .unwrap();

        watcher.watch(std::path::Path::new(&path), RecursiveMode::Recursive)
            .map_err(|e| format!("Watch failed: {}", e))
            .unwrap();

        loop {
            match rx.recv_timeout(Duration::from_secs(1)) {
                Ok(Ok(event)) => {
                    match event.kind {
                        EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_) => {
                            let paths: Vec<String> = event.paths
                                .iter()
                                .map(|p| p.to_string_lossy().to_string())
                                .collect();

                            let _ = app_handle.emit("file-changed", serde_json::json!({
                                "paths": paths,
                                "kind": format!("{:?}", event.kind),
                            }));
                        }
                        _ => {}
                    }
                }
                Ok(Err(e)) => {
                    let _ = app_handle.emit("file-watch-error", format!("{}", e));
                }
                Err(mpsc::RecvTimeoutError::Timeout) => continue,
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
    });

    Ok(())
}
