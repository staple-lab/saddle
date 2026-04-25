// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod file_operations;
mod frontmatter_parser;

use file_operations::{scan_directory, read_file, FileInfo};
use frontmatter_parser::{parse_frontmatter, ParsedFile};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn scan_project_directory(path: String) -> Result<Vec<FileInfo>, String> {
    scan_directory(&path)
}

#[tauri::command]
fn read_component_file(path: String) -> Result<String, String> {
    read_file(&path)
}

#[tauri::command]
fn parse_component_file(content: String) -> Result<ParsedFile, String> {
    parse_frontmatter(&content)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            scan_project_directory,
            read_component_file,
            parse_component_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
