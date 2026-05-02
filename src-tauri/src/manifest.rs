//! Authoritative project manifest. Source of truth for what components
//! and variants Saddle shows in the gallery.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Manifest {
    #[serde(rename = "$schema", default = "default_schema")]
    pub schema: String,
    pub version: u32,
    pub components: Vec<ManifestComponent>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ManifestComponent {
    pub id: String,
    pub name: String,
    pub directory: String,
    pub variants: Vec<ManifestVariant>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ManifestVariant {
    pub id: String,
    pub name: String,
    pub file: String,
    pub doc: String,
}

fn default_schema() -> String {
    "saddle/manifest/v1".to_string()
}

#[derive(Debug, thiserror::Error)]
pub enum ManifestError {
    #[error("manifest file not found at {0}")]
    NotFound(String),
    #[error("manifest is not valid JSON: {0}")]
    InvalidJson(String),
    #[error("manifest version {0} is newer than this Saddle build supports")]
    UnsupportedVersion(u32),
    #[error("manifest validation failed: {0}")]
    ValidationError(String),
    #[error("io error: {0}")]
    Io(String),
}

fn validate_path(label: &str, path: &str) -> Result<(), ManifestError> {
    if path.is_empty() {
        return Err(ManifestError::ValidationError(format!("{} is empty", label)));
    }
    if path.starts_with('/') || (path.len() >= 2 && &path[1..2] == ":") {
        return Err(ManifestError::ValidationError(format!(
            "{} '{}' must be relative (no absolute paths)",
            label, path
        )));
    }
    if path.split('/').any(|seg| seg == "..") {
        return Err(ManifestError::ValidationError(format!(
            "{} '{}' contains path traversal ('..')",
            label, path
        )));
    }
    Ok(())
}

fn validate_manifest(manifest: &Manifest) -> Result<(), ManifestError> {
    for c in &manifest.components {
        if c.id.is_empty() || c.name.is_empty() {
            return Err(ManifestError::ValidationError(
                "component id/name cannot be empty".to_string(),
            ));
        }
        validate_path("component.directory", &c.directory)?;
        if c.variants.is_empty() {
            return Err(ManifestError::ValidationError(format!(
                "component '{}' has no variants",
                c.name
            )));
        }
        for v in &c.variants {
            if v.id.is_empty() || v.name.is_empty() {
                return Err(ManifestError::ValidationError(
                    "variant id/name cannot be empty".to_string(),
                ));
            }
            validate_path("variant.file", &v.file)?;
            validate_path("variant.doc", &v.doc)?;
        }
    }

    // Globally unique variant ids — manifest-wide, not per-component.
    let mut seen_ids = std::collections::HashSet::<&str>::new();
    for c in &manifest.components {
        for v in &c.variants {
            if !seen_ids.insert(v.id.as_str()) {
                return Err(ManifestError::ValidationError(format!(
                    "duplicate variant id '{}'",
                    v.id
                )));
            }
        }
    }

    Ok(())
}

pub fn parse_manifest(content: &str) -> Result<Manifest, ManifestError> {
    let manifest: Manifest = serde_json::from_str(content)
        .map_err(|e| ManifestError::InvalidJson(e.to_string()))?;
    if manifest.version != 1 {
        return Err(ManifestError::UnsupportedVersion(manifest.version));
    }
    validate_manifest(&manifest)?;
    Ok(manifest)
}

pub fn serialize_manifest(manifest: &Manifest) -> String {
    serde_json::to_string_pretty(manifest).expect("manifest serialization is infallible") + "\n"
}

/// Merge a freshly-built ("desired") manifest with an existing one,
/// preserving stable `id` values for variants matched by `file` path
/// and for components matched by `directory` path. Variants in the
/// desired manifest with no match get a freshly slugged id.
pub fn merge_preserve_ids(existing: &Manifest, mut desired: Manifest) -> Manifest {
    for c in &mut desired.components {
        if let Some(existing_c) = existing
            .components
            .iter()
            .find(|ec| ec.directory == c.directory)
        {
            c.id = existing_c.id.clone();
        } else {
            c.id = slugify(&c.name);
        }

        for v in &mut c.variants {
            let match_in_existing_c = existing
                .components
                .iter()
                .find(|ec| ec.directory == c.directory)
                .and_then(|ec| ec.variants.iter().find(|ev| ev.file == v.file));

            if let Some(existing_v) = match_in_existing_c {
                v.id = existing_v.id.clone();
            } else {
                v.id = slugify(&format!("{}-{}", c.name, v.name));
            }
        }
    }
    desired
}

fn slugify(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut prev_dash = false;
    for ch in input.chars() {
        if ch.is_ascii_alphanumeric() {
            for c in ch.to_lowercase() {
                out.push(c);
            }
            prev_dash = false;
        } else if !prev_dash && !out.is_empty() {
            out.push('-');
            prev_dash = true;
        }
    }
    while out.ends_with('-') {
        out.pop();
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Manifest {
        Manifest {
            schema: "saddle/manifest/v1".to_string(),
            version: 1,
            components: vec![ManifestComponent {
                id: "button".to_string(),
                name: "Button".to_string(),
                directory: "src/components/Button".to_string(),
                variants: vec![ManifestVariant {
                    id: "button-primary".to_string(),
                    name: "Primary".to_string(),
                    file: "Button.Primary.tsx".to_string(),
                    doc: "Button.Primary.md".to_string(),
                }],
            }],
        }
    }

    #[test]
    fn parse_manifest_v1_roundtrip() {
        let original = sample();
        let json = serialize_manifest(&original);
        let parsed = parse_manifest(&json).expect("roundtrip parse");
        assert_eq!(parsed, original);
    }

    #[test]
    fn parse_rejects_higher_version() {
        let json = r#"{"$schema":"saddle/manifest/v1","version":2,"components":[]}"#;
        match parse_manifest(json) {
            Err(ManifestError::UnsupportedVersion(2)) => {}
            other => panic!("expected UnsupportedVersion(2), got {:?}", other),
        }
    }

    fn make_manifest_with_paths(component_dir: &str, file: &str, doc: &str) -> String {
        format!(
            r#"{{"$schema":"saddle/manifest/v1","version":1,"components":[{{"id":"x","name":"X","directory":"{}","variants":[{{"id":"x-d","name":"D","file":"{}","doc":"{}"}}]}}]}}"#,
            component_dir, file, doc
        )
    }

    #[test]
    fn parse_rejects_absolute_directory() {
        let json = make_manifest_with_paths("/abs/path", "X.tsx", "X.md");
        match parse_manifest(&json) {
            Err(ManifestError::ValidationError(msg)) => assert!(msg.contains("absolute"), "msg: {}", msg),
            other => panic!("expected ValidationError, got {:?}", other),
        }
    }

    #[test]
    fn parse_rejects_traversal_in_file() {
        let json = make_manifest_with_paths("src/x", "../sneak.tsx", "X.md");
        match parse_manifest(&json) {
            Err(ManifestError::ValidationError(msg)) => assert!(msg.contains("traversal") || msg.contains("..")),
            other => panic!("expected ValidationError, got {:?}", other),
        }
    }

    #[test]
    fn parse_rejects_empty_field() {
        let json = make_manifest_with_paths("src/x", "", "X.md");
        match parse_manifest(&json) {
            Err(ManifestError::ValidationError(msg)) => assert!(msg.contains("empty") || msg.contains("file")),
            other => panic!("expected ValidationError, got {:?}", other),
        }
    }

    #[test]
    fn parse_rejects_duplicate_ids() {
        let json = r#"{
            "$schema":"saddle/manifest/v1","version":1,
            "components":[{
                "id":"button","name":"Button","directory":"src/components/Button",
                "variants":[
                    {"id":"dup","name":"A","file":"A.tsx","doc":"A.md"},
                    {"id":"dup","name":"B","file":"B.tsx","doc":"B.md"}
                ]
            }]
        }"#;
        match parse_manifest(json) {
            Err(ManifestError::ValidationError(msg)) => assert!(msg.contains("dup"), "msg: {}", msg),
            other => panic!("expected ValidationError, got {:?}", other),
        }
    }

    #[test]
    fn merge_diff_preserves_ids() {
        let existing = sample();

        let desired = Manifest {
            schema: "saddle/manifest/v1".to_string(),
            version: 1,
            components: vec![ManifestComponent {
                id: "button".to_string(),
                name: "Button".to_string(),
                directory: "src/components/Button".to_string(),
                variants: vec![
                    ManifestVariant {
                        id: "__new__".to_string(),
                        name: "Primary".to_string(),
                        file: "Button.Primary.tsx".to_string(),
                        doc: "Button.Primary.md".to_string(),
                    },
                    ManifestVariant {
                        id: "__new__".to_string(),
                        name: "Ghost".to_string(),
                        file: "Button.Ghost.tsx".to_string(),
                        doc: "Button.Ghost.md".to_string(),
                    },
                ],
            }],
        };

        let merged = merge_preserve_ids(&existing, desired);

        // First variant matches existing by `file`, so id is preserved.
        assert_eq!(merged.components[0].variants[0].id, "button-primary");
        // Second variant is new — gets a freshly slugged id, not "__new__".
        assert_ne!(merged.components[0].variants[1].id, "__new__");
        assert!(!merged.components[0].variants[1].id.is_empty());
    }
}
