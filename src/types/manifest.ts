// src/types/manifest.ts
// Mirror of the Rust Manifest types in src-tauri/src/manifest.rs.

export interface ManifestVariant {
  id: string;
  name: string;
  file: string; // relative to project root
  doc: string;  // relative to project root
}

export interface ManifestComponent {
  id: string;
  name: string;
  directory: string; // relative to project root
  variants: ManifestVariant[];
}

export interface Manifest {
  $schema?: string;
  version: 1;
  components: ManifestComponent[];
}

export type ManifestCommandError =
  | { kind: 'not_found'; path: string }
  | { kind: 'invalid_json'; message: string }
  | { kind: 'unsupported_version'; version: number }
  | { kind: 'validation_error'; message: string }
  | { kind: 'io'; message: string };

export function isManifestCommandError(e: unknown): e is ManifestCommandError {
  return !!e && typeof e === 'object' && 'kind' in (e as Record<string, unknown>);
}
