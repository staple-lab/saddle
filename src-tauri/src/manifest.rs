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

pub fn parse_manifest(content: &str) -> Result<Manifest, ManifestError> {
    let manifest: Manifest = serde_json::from_str(content)
        .map_err(|e| ManifestError::InvalidJson(e.to_string()))?;
    if manifest.version != 1 {
        return Err(ManifestError::UnsupportedVersion(manifest.version));
    }
    Ok(manifest)
}

pub fn serialize_manifest(manifest: &Manifest) -> String {
    serde_json::to_string_pretty(manifest).expect("manifest serialization is infallible") + "\n"
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
}
