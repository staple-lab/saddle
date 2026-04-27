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
