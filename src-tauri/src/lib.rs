// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod file_operations;
mod frontmatter_parser;
mod config_loader;
mod mcp_server;
mod css_generator;
mod dedup_analyzer;

use file_operations::{scan_directory, read_file, update_component_tokens, FileInfo};
use frontmatter_parser::{parse_frontmatter, ParsedFile};
use config_loader::{load_config, SaddleConfig};
use mcp_server::{get_available_tools, MCPTool, create_variant_file};
use css_generator::{generate_css_module, generate_global_css};
use dedup_analyzer::{analyze_token_duplication, analyze_structure_duplication, DuplicateToken, StructureDuplicate};

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

#[tauri::command]
fn create_variant(
    component_directory: String,
    component_name: String,
    variant_name: String,
    tokens_json: Option<String>,
    description: Option<String>,
) -> Result<String, String> {
    let tokens = tokens_json
        .as_ref()
        .map(|j| serde_json::from_str::<serde_json::Value>(j))
        .transpose()
        .map_err(|e| format!("Failed to parse tokens: {}", e))?;

    create_variant_file(
        &component_directory,
        &component_name,
        &variant_name,
        tokens.as_ref(),
        description.as_deref(),
    )
}

#[tauri::command]
fn write_component_file(file_path: String, content: String) -> Result<(), String> {
    file_operations::write_file(&file_path, &content)
}

#[tauri::command]
fn analyze_duplicates(components_json: String) -> Result<Vec<DuplicateToken>, String> {
    analyze_token_duplication(&components_json)
}

#[tauri::command]
fn analyze_structure(components_json: String) -> Result<Vec<StructureDuplicate>, String> {
    analyze_structure_duplication(&components_json)
}

#[tauri::command]
fn build_package(
    project_root: String,
    package_name: String,
    components_json: String,
) -> Result<String, String> {
    use std::fs;
    use std::path::Path;

    let dist_path = Path::new(&project_root).join("dist");
    fs::create_dir_all(&dist_path).map_err(|e| format!("Failed to create dist: {}", e))?;

    // Parse components
    let components: Vec<serde_json::Value> = serde_json::from_str(&components_json)
        .map_err(|e| format!("Failed to parse: {}", e))?;

    // Generate index.ts
    let mut index_exports = Vec::new();
    let mut css_content = String::new();

    for component in &components {
        let name = component["name"].as_str().unwrap_or("Component");
        if let Some(variants) = component["variants"].as_array() {
            for variant in variants {
                let var_name = variant["variantName"].as_str().unwrap_or("Default");
                let code = variant["code"].as_str().unwrap_or("");
                let file_name = format!("{}.{}.tsx", name, var_name);

                // Write component file (stripped of frontmatter)
                let comp_path = dist_path.join(&file_name);
                fs::write(&comp_path, code).map_err(|e| format!("Write failed: {}", e))?;

                index_exports.push(format!("export {{ {} }} from './{}.{}';", format!("{}{}", name, var_name), name, var_name));

                // Generate CSS from tokens
                if let Some(tokens) = variant["frontmatter"]["tokens"].as_object() {
                    let token_map: std::collections::HashMap<String, String> = tokens
                        .iter()
                        .filter_map(|(k, v)| v.as_str().map(|vs| (k.clone(), vs.to_string())))
                        .collect();
                    let css = generate_css_module(name, var_name, &token_map);
                    let css_file = format!("{}.{}.module.css", name, var_name);
                    fs::write(dist_path.join(&css_file), &css)
                        .map_err(|e| format!("CSS write failed: {}", e))?;
                }
            }
        }
    }

    // Write index.ts
    let index_content = index_exports.join("\n") + "\n";
    fs::write(dist_path.join("index.ts"), &index_content)
        .map_err(|e| format!("Index write failed: {}", e))?;

    // Generate global CSS
    let config_path = Path::new(&project_root).join("saddle.config.json");
    if config_path.exists() {
        let config_str = fs::read_to_string(&config_path)
            .map_err(|e| format!("Config read failed: {}", e))?;
        let config: serde_json::Value = serde_json::from_str(&config_str)
            .map_err(|e| format!("Config parse failed: {}", e))?;
        if let Some(tokens) = config.get("tokens") {
            let global_css = generate_global_css(tokens);
            fs::write(dist_path.join("tokens.css"), &global_css)
                .map_err(|e| format!("CSS write failed: {}", e))?;
        }
    }

    // Generate package.json
    let pkg_json = serde_json::json!({
        "name": package_name,
        "version": "0.1.0",
        "type": "module",
        "main": "./index.ts",
        "exports": {
            ".": {
                "development": "./index.ts",
                "default": "./index.ts"
            },
            "./tokens.css": "./tokens.css"
        },
        "peerDependencies": {
            "react": ">=18"
        }
    });
    fs::write(
        dist_path.join("package.json"),
        serde_json::to_string_pretty(&pkg_json).unwrap(),
    ).map_err(|e| format!("Package.json write failed: {}", e))?;

    Ok(dist_path.to_string_lossy().to_string())
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
            generate_global_tokens_css,
            create_variant,
            write_component_file,
            analyze_duplicates,
            analyze_structure,
            build_package
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
