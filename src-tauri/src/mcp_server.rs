use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{self, BufRead, Write};
use std::sync::{Arc, Mutex};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ComponentSchema {
    pub name: String,
    pub variants: Vec<VariantSchema>,
    pub directory: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VariantSchema {
    pub name: String,
    pub file_path: String,
    pub tokens: HashMap<String, String>,
    pub props: Vec<String>,
    pub description: Option<String>,
    pub usage: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MCPTool {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

// JSON-RPC types for MCP protocol
#[derive(Debug, Serialize, Deserialize)]
struct JsonRpcRequest {
    jsonrpc: String,
    id: Option<serde_json::Value>,
    method: String,
    params: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
struct JsonRpcResponse {
    jsonrpc: String,
    id: serde_json::Value,
    result: Option<serde_json::Value>,
    error: Option<JsonRpcError>,
}

#[derive(Debug, Serialize)]
struct JsonRpcError {
    code: i32,
    message: String,
}

pub fn get_available_tools() -> Vec<MCPTool> {
    vec![
        MCPTool {
            name: "saddle_list_components".to_string(),
            description: "List all components in the currently loaded Saddle project with their variants, tokens, and metadata".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {}
            }),
        },
        MCPTool {
            name: "saddle_get_component".to_string(),
            description: "Get full schema for a specific component including all variants, tokens, props, description, and usage guidelines".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "component_name": {
                        "type": "string",
                        "description": "Name of the component (e.g. 'TestButton')"
                    }
                },
                "required": ["component_name"]
            }),
        },
        MCPTool {
            name: "saddle_update_tokens".to_string(),
            description: "Update design tokens for a component variant. Changes are saved to the file and reflected in the Saddle UI immediately".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Absolute path to the component file"
                    },
                    "tokens": {
                        "type": "object",
                        "description": "Token key-value pairs to set (e.g. {\"backgroundColor\": \"#007AFF\", \"borderRadius\": \"8px\"})"
                    }
                },
                "required": ["file_path", "tokens"]
            }),
        },
        MCPTool {
            name: "saddle_get_global_tokens".to_string(),
            description: "Get global design tokens defined in saddle.config.json (colors, spacing, rounded, fontSize)".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {}
            }),
        },
        MCPTool {
            name: "saddle_read_component_code".to_string(),
            description: "Read the full source code of a component variant file including design.md frontmatter".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Absolute path to the component file"
                    }
                },
                "required": ["file_path"]
            }),
        },
        MCPTool {
            name: "saddle_create_variant".to_string(),
            description: "Create a new variant file for an existing component with design.md frontmatter and boilerplate code".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "component_directory": {
                        "type": "string",
                        "description": "Absolute path to the component directory"
                    },
                    "component_name": {
                        "type": "string",
                        "description": "Component name (e.g. 'Button')"
                    },
                    "variant_name": {
                        "type": "string",
                        "description": "New variant name (e.g. 'Ghost')"
                    },
                    "tokens": {
                        "type": "object",
                        "description": "Initial token values"
                    },
                    "description": {
                        "type": "string",
                        "description": "Component description for AI guidance"
                    }
                },
                "required": ["component_directory", "component_name", "variant_name"]
            }),
        },
    ]
}

pub struct MCPServer {
    pub project_root: Option<String>,
    pub components: Vec<ComponentSchema>,
}

impl MCPServer {
    pub fn new() -> Self {
        MCPServer {
            project_root: None,
            components: Vec::new(),
        }
    }

    pub fn set_project(&mut self, root: String, components: Vec<ComponentSchema>) {
        self.project_root = Some(root);
        self.components = components;
    }

    pub fn get_component(&self, name: &str) -> Option<&ComponentSchema> {
        self.components.iter().find(|c| c.name == name)
    }

    pub fn list_components(&self) -> Vec<serde_json::Value> {
        self.components.iter().map(|c| {
            serde_json::json!({
                "name": c.name,
                "directory": c.directory,
                "variant_count": c.variants.len(),
                "variants": c.variants.iter().map(|v| {
                    serde_json::json!({
                        "name": v.name,
                        "file_path": v.file_path,
                        "description": v.description,
                    })
                }).collect::<Vec<_>>()
            })
        }).collect()
    }
}

pub fn create_variant_file(
    component_directory: &str,
    component_name: &str,
    variant_name: &str,
    tokens: Option<&serde_json::Value>,
    description: Option<&str>,
) -> Result<String, String> {
    use std::fs;
    use std::path::Path;

    let file_name = format!("{}.{}.tsx", component_name, variant_name);
    let file_path = Path::new(component_directory).join(&file_name);

    if file_path.exists() {
        return Err(format!("Variant file already exists: {}", file_path.display()));
    }

    let tokens_yaml = if let Some(t) = tokens {
        if let Some(obj) = t.as_object() {
            obj.iter()
                .map(|(k, v)| format!("  {}: \"{}\"", k, v.as_str().unwrap_or("")))
                .collect::<Vec<_>>()
                .join("\n")
        } else {
            String::new()
        }
    } else {
        String::from("  backgroundColor: \"#ffffff\"")
    };

    let desc = description.unwrap_or(&format!("{} {} variant", component_name, variant_name));

    let content = format!(
r#"---
name: {} {}
description: {}
tokens:
{}
props:
  - label: string
usage: |
  Describe when to use the {} variant.
---

import React from 'react';

interface Props {{
  label: string;
}}

export const {}{}: React.FC<Props> = ({{ label }}) => {{
  return (
    <div>
      {{label}}
    </div>
  );
}};
"#,
        component_name, variant_name,
        desc,
        tokens_yaml,
        variant_name,
        component_name, variant_name,
    );

    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write variant file: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}
