// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod file_operations;
mod frontmatter_parser;
mod config_loader;
mod mcp_server;
mod css_generator;

use file_operations::{scan_directory, read_file, update_component_tokens, FileInfo};
use frontmatter_parser::{parse_frontmatter, ParsedFile};
use config_loader::{load_config, SaddleConfig};
use mcp_server::{get_available_tools, MCPTool};
use css_generator::{generate_css_module, generate_global_css};

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

#[tauri::command]
fn update_tokens(file_path: String, tokens_json: String) -> Result<(), String> {
    update_component_tokens(&file_path, &tokens_json)
}

#[tauri::command]
fn load_global_config(project_root: String) -> Result<SaddleConfig, String> {
    load_config(&project_root)
}

#[tauri::command]
fn get_mcp_tools() -> Vec<MCPTool> {
    get_available_tools()
}

#[tauri::command]
fn generate_css(component_name: String, variant_name: String, tokens_json: String) -> Result<String, String> {
    let tokens: std::collections::HashMap<String, String> = serde_json::from_str(&tokens_json)
        .map_err(|e| format!("Failed to parse tokens: {}", e))?;
    Ok(generate_css_module(&component_name, &variant_name, &tokens))
}

#[tauri::command]
fn generate_global_tokens_css(tokens_json: String) -> Result<String, String> {
    let tokens: serde_json::Value = serde_json::from_str(&tokens_json)
        .map_err(|e| format!("Failed to parse tokens: {}", e))?;
    Ok(generate_global_css(&tokens))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            scan_project_directory,
            read_component_file,
            parse_component_file,
            update_tokens,
            load_global_config,
            get_mcp_tools,
            generate_css,
            generate_global_tokens_css
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
