use regex::Regex;
use serde_json::Value;

#[derive(serde::Serialize, serde::Deserialize, Debug)]
pub struct ParsedFile {
    pub frontmatter: Option<Value>,
    pub code: String,
}

pub fn parse_frontmatter(content: &str) -> Result<ParsedFile, String> {
    let re = Regex::new(r"(?s)^---\s*\n(.*?)\n---\s*\n(.*)$")
        .map_err(|e| format!("Regex error: {}", e))?;

    if let Some(captures) = re.captures(content) {
        let yaml_str = captures.get(1)
            .ok_or("Failed to extract YAML")?
            .as_str();
        let code = captures.get(2)
            .ok_or("Failed to extract code")?
            .as_str()
            .to_string();

        let frontmatter: Value = serde_yaml::from_str(yaml_str)
            .map_err(|e| format!("YAML parse error: {}", e))?;

        Ok(ParsedFile {
            frontmatter: Some(frontmatter),
            code,
        })
    } else {
        // No frontmatter, return entire content as code
        Ok(ParsedFile {
            frontmatter: None,
            code: content.to_string(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_with_frontmatter() {
        let content = r###"---
name: Button Primary
description: Primary action button
tokens:
  backgroundColor: "#000"
---

export const ButtonPrimary = () => <button>Click</button>;
"###;

        let result = parse_frontmatter(content).unwrap();
        assert!(result.frontmatter.is_some());
        assert!(result.code.contains("ButtonPrimary"));
    }

    #[test]
    fn test_parse_without_frontmatter() {
        let content = "export const Button = () => <button>Click</button>;";
        let result = parse_frontmatter(content).unwrap();
        assert!(result.frontmatter.is_none());
        assert_eq!(result.code, content);
    }
}
