use serde::Serialize;
use std::collections::HashMap;

#[derive(Debug, Serialize, Clone)]
pub struct DuplicateToken {
    pub value: String,
    pub property: String,
    pub occurrences: Vec<TokenOccurrence>,
    pub suggested_token_name: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct TokenOccurrence {
    pub component_name: String,
    pub variant_name: String,
    pub file_path: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct StructureDuplicate {
    pub pattern: String,
    pub occurrences: Vec<String>,
    pub suggestion: String,
}

pub fn analyze_token_duplication(
    components_json: &str,
) -> Result<Vec<DuplicateToken>, String> {
    let components: Vec<serde_json::Value> = serde_json::from_str(components_json)
        .map_err(|e| format!("Failed to parse components: {}", e))?;

    // Collect all token values across all components
    let mut value_map: HashMap<(String, String), Vec<TokenOccurrence>> = HashMap::new();

    for component in &components {
        let comp_name = component["name"].as_str().unwrap_or("unknown");
        if let Some(variants) = component["variants"].as_array() {
            for variant in variants {
                let var_name = variant["variantName"].as_str().unwrap_or("Default");
                let file_path = variant["filePath"].as_str().unwrap_or("");

                if let Some(tokens) = variant["frontmatter"]["tokens"].as_object() {
                    for (prop, val) in tokens {
                        if let Some(value_str) = val.as_str() {
                            let key = (prop.clone(), value_str.to_string());
                            value_map.entry(key).or_default().push(TokenOccurrence {
                                component_name: comp_name.to_string(),
                                variant_name: var_name.to_string(),
                                file_path: file_path.to_string(),
                            });
                        }
                    }
                }
            }
        }
    }

    // Filter to only those appearing in 2+ components
    let duplicates: Vec<DuplicateToken> = value_map
        .into_iter()
        .filter(|(_, occurrences)| occurrences.len() >= 2)
        .map(|((property, value), occurrences)| {
            let suggested = suggest_token_name(&property, &value);
            DuplicateToken {
                value,
                property,
                occurrences,
                suggested_token_name: suggested,
            }
        })
        .collect();

    Ok(duplicates)
}

fn suggest_token_name(property: &str, value: &str) -> String {
    let prop_lower = property.to_lowercase();

    if prop_lower.contains("color") || prop_lower.contains("background") {
        if value.starts_with('#') || value.starts_with("rgb") {
            return format!("colors.custom-{}", &value[1..].get(..6).unwrap_or("val"));
        }
    }

    if prop_lower.contains("padding") || prop_lower.contains("margin") || prop_lower.contains("gap") {
        let num = value.replace("px", "").replace("rem", "").replace("em", "");
        return format!("spacing.custom-{}", num);
    }

    if prop_lower.contains("radius") {
        let num = value.replace("px", "");
        return format!("rounded.custom-{}", num);
    }

    if prop_lower.contains("font") && prop_lower.contains("size") {
        let num = value.replace("px", "");
        return format!("fontSize.custom-{}", num);
    }

    format!("custom.{}-{}", property, value.replace(' ', "-"))
}

pub fn analyze_structure_duplication(
    components_json: &str,
) -> Result<Vec<StructureDuplicate>, String> {
    let components: Vec<serde_json::Value> = serde_json::from_str(components_json)
        .map_err(|e| format!("Failed to parse: {}", e))?;

    let mut code_patterns: HashMap<String, Vec<String>> = HashMap::new();

    for component in &components {
        let comp_name = component["name"].as_str().unwrap_or("unknown");
        if let Some(variants) = component["variants"].as_array() {
            for variant in variants {
                if let Some(code) = variant["code"].as_str() {
                    // Extract JSX return patterns (simplified)
                    if let Some(start) = code.find("return") {
                        let pattern = &code[start..];
                        // Normalize whitespace for comparison
                        let normalized: String = pattern.chars()
                            .filter(|c| !c.is_whitespace())
                            .take(200)
                            .collect();

                        code_patterns
                            .entry(normalized)
                            .or_default()
                            .push(format!("{}/{}", comp_name,
                                variant["variantName"].as_str().unwrap_or("Default")));
                    }
                }
            }
        }
    }

    let duplicates: Vec<StructureDuplicate> = code_patterns
        .into_iter()
        .filter(|(_, files)| files.len() >= 2)
        .map(|(pattern, occurrences)| {
            StructureDuplicate {
                pattern: pattern.chars().take(100).collect::<String>() + "...",
                suggestion: format!(
                    "These {} variants share the same structure. Consider extracting to a shared component.",
                    occurrences.len()
                ),
                occurrences,
            }
        })
        .collect();

    Ok(duplicates)
}
