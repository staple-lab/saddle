use std::collections::HashMap;

pub fn generate_css_module(
    component_name: &str,
    variant_name: &str,
    tokens: &HashMap<String, String>,
) -> String {
    let mut css = format!("/* {}.{}.module.css - Generated from tokens */\n\n", component_name, variant_name);
    css.push_str(".root {\n");

    for (key, value) in tokens {
        let css_property = camel_to_kebab(key);
        css.push_str(&format!("  {}: {};\n", css_property, resolve_token(value)));
    }

    css.push_str("}\n");
    css
}

pub fn generate_global_css(tokens: &serde_json::Value) -> String {
    let mut css = String::from(":root {\n");

    if let Some(colors) = tokens.get("colors").and_then(|v| v.as_object()) {
        css.push_str("  /* Colors */\n");
        for (name, value) in colors {
            if let Some(val) = value.as_str() {
                css.push_str(&format!("  --colors-{}: {};\n", name, val));
            }
        }
        css.push('\n');
    }

    if let Some(spacing) = tokens.get("spacing").and_then(|v| v.as_object()) {
        css.push_str("  /* Spacing */\n");
        for (name, value) in spacing {
            if let Some(val) = value.as_str() {
                css.push_str(&format!("  --spacing-{}: {};\n", name, val));
            }
        }
        css.push('\n');
    }

    if let Some(rounded) = tokens.get("rounded").and_then(|v| v.as_object()) {
        css.push_str("  /* Border Radius */\n");
        for (name, value) in rounded {
            if let Some(val) = value.as_str() {
                css.push_str(&format!("  --rounded-{}: {};\n", name, val));
            }
        }
        css.push('\n');
    }

    if let Some(font_size) = tokens.get("fontSize").and_then(|v| v.as_object()) {
        css.push_str("  /* Font Size */\n");
        for (name, value) in font_size {
            if let Some(val) = value.as_str() {
                css.push_str(&format!("  --font-size-{}: {};\n", name, val));
            }
        }
    }

    css.push_str("}\n");
    css
}

fn camel_to_kebab(s: &str) -> String {
    let mut result = String::new();
    for (i, ch) in s.chars().enumerate() {
        if ch.is_uppercase() && i > 0 {
            result.push('-');
            result.push(ch.to_lowercase().next().unwrap());
        } else {
            result.push(ch);
        }
    }
    result
}

fn resolve_token(value: &str) -> String {
    // If it's already a var() reference, return as-is
    if value.starts_with("var(") {
        return value.to_string();
    }

    // If it's a token reference like "{colors.primary}", convert to CSS variable
    if value.starts_with('{') && value.ends_with('}') {
        let token_path = &value[1..value.len()-1];
        let parts: Vec<&str> = token_path.split('.').collect();
        if parts.len() == 2 {
            return format!("var(--{}-{})", parts[0], parts[1]);
        }
    }

    // Otherwise return the raw value
    value.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_camel_to_kebab() {
        assert_eq!(camel_to_kebab("backgroundColor"), "background-color");
        assert_eq!(camel_to_kebab("padding"), "padding");
        assert_eq!(camel_to_kebab("borderRadius"), "border-radius");
    }

    #[test]
    fn test_resolve_token() {
        assert_eq!(resolve_token("{colors.primary}"), "var(--colors-primary)");
        assert_eq!(resolve_token("var(--color-bg)"), "var(--color-bg)");
        assert_eq!(resolve_token("#000000"), "#000000");
    }
}
