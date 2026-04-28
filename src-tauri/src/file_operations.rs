// src-tauri/src/file_operations.rs
use walkdir::WalkDir;

#[derive(serde::Serialize)]
pub struct FileInfo {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
}

const SKIP_DIRS: &[&str] = &[
    "node_modules",
    "dist",
    "build",
    "out",
    "target",
    "coverage",
    ".next",
    ".nuxt",
    ".turbo",
    ".cache",
    ".vercel",
    ".parcel-cache",
    ".svelte-kit",
];

pub fn scan_directory(path: &str) -> Result<Vec<FileInfo>, String> {
    let mut files = Vec::new();

    let walker = WalkDir::new(path).max_depth(5).into_iter().filter_entry(|e| {
        // Always include the root entry
        if e.depth() == 0 {
            return true;
        }
        let name = e.file_name().to_string_lossy();
        // Skip hidden dirs/files (.git, .DS_Store, etc.)
        if name.starts_with('.') {
            return false;
        }
        // Skip known dependency/build output dirs
        if e.file_type().is_dir() && SKIP_DIRS.contains(&name.as_ref()) {
            return false;
        }
        true
    });

    for entry in walker.filter_map(|e| e.ok()) {
        let path_str = entry.path().to_string_lossy().to_string();
        let name = entry.file_name().to_string_lossy().to_string();
        let is_dir = entry.path().is_dir();

        files.push(FileInfo {
            path: path_str,
            name,
            is_dir,
        });
    }

    Ok(files)
}

pub fn read_file(path: &str) -> Result<String, String> {
    std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

pub fn write_file(path: &str, content: &str) -> Result<(), String> {
    std::fs::write(path, content)
        .map_err(|e| format!("Failed to write file: {}", e))
}

pub fn update_component_tokens(
    file_path: &str,
    tokens_json: &str,
) -> Result<(), String> {
    // Read the file
    let content = read_file(file_path)?;

    // Parse tokens
    let tokens: serde_json::Value = serde_json::from_str(tokens_json)
        .map_err(|e| format!("Failed to parse tokens JSON: {}", e))?;

    // Split into frontmatter and code
    let parts: Vec<&str> = content.split("---").collect();
    if parts.len() < 3 {
        return Err("Invalid frontmatter format".to_string());
    }

    // Parse existing frontmatter
    let mut frontmatter: serde_yaml::Value =
        serde_yaml::from_str(parts[1]).map_err(|e| format!("Failed to parse YAML: {}", e))?;

    // Update tokens
    if let Some(map) = frontmatter.as_mapping_mut() {
        let tokens_yaml = serde_yaml::to_value(&tokens)
            .map_err(|e| format!("Failed to convert tokens: {}", e))?;
        map.insert(
            serde_yaml::Value::String("tokens".to_string()),
            tokens_yaml,
        );
    }

    // Serialize back to YAML
    let yaml_str =
        serde_yaml::to_string(&frontmatter).map_err(|e| format!("Failed to serialize: {}", e))?;

    // Reconstruct file
    let new_content = format!("---\n{}---{}", yaml_str, parts[2..].join("---"));

    // Write back
    write_file(file_path, &new_content)?;

    Ok(())
}

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
