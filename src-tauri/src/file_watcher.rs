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
                    let paths: Vec<String> = event
                        .paths
                        .iter()
                        .map(|p| p.to_string_lossy().to_string())
                        .collect();
                    let _ = app_handle.emit(
                        "file-changed",
                        serde_json::json!({
                            "paths": paths.clone(),
                            "kind": format!("{:?}", event.kind),
                        }),
                    );
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
    let root_trimmed = project_root.trim_end_matches('/').replace('\\', "/");
    let dirs: Vec<String> = manifest
        .components
        .iter()
        .map(|c| format!("{}/{}", root_trimmed, c.directory))
        .collect();
    let extensions = [".tsx", ".jsx", ".ts", ".js"];
    let mut keep = Vec::new();
    for p in paths {
        let normalised = p.replace('\\', "/");
        if dirs.iter().any(|d| normalised.starts_with(d))
            && extensions.iter().any(|e| normalised.ends_with(e))
        {
            let prefix = format!("{}/", root_trimmed);
            let rel = normalised
                .strip_prefix(&prefix)
                .unwrap_or(&normalised)
                .to_string();
            keep.push(rel);
        }
    }
    if keep.is_empty() {
        None
    } else {
        Some(keep)
    }
}

fn emit_drift(
    app: &AppHandle,
    project_root: &str,
    added: &HashSet<String>,
    removed: &HashSet<String>,
) {
    if added.is_empty() && removed.is_empty() {
        return;
    }
    let manifest_files: HashSet<String> = match manifest::read_manifest_from_disk(Path::new(project_root)) {
        Ok(m) => m
            .components
            .iter()
            .flat_map(|c| c.variants.iter().map(|v| v.file.clone()))
            .collect(),
        Err(_) => HashSet::new(),
    };

    let added_filtered: Vec<&String> = added
        .iter()
        .filter(|a| !manifest_files.contains(*a))
        .collect();
    let removed_filtered: Vec<&String> = removed
        .iter()
        .filter(|r| manifest_files.contains(*r))
        .collect();

    let _ = app.emit(
        "manifest-drift",
        serde_json::json!({
            "added": added_filtered,
            "removed": removed_filtered,
        }),
    );
}
