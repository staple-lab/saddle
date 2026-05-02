import { invoke } from '@tauri-apps/api/core';
import type { Component, ProjectStructure } from '../types/component';
import type { Manifest } from '../types/manifest';

export interface FileInfo {
  path: string;
  name: string;
  is_dir: boolean;
}

export interface ViteSetup {
  has_vite: boolean;
  vite_config_path: string | null;
  stories_path: string | null;
  dev_script: string | null;
}

export async function detectViteSetup(projectRoot: string): Promise<ViteSetup> {
  return invoke<ViteSetup>('detect_vite', { projectRoot });
}

export async function writeSaddleRuntime(projectRoot: string, viteConfigPath: string | null): Promise<void> {
  return invoke<void>('write_saddle_runtime_files', { projectRoot, viteConfigPath });
}

export async function spawnDevServer(projectRoot: string): Promise<string> {
  return invoke<string>('spawn_dev_server', { projectRoot });
}

export async function killDevServer(): Promise<void> {
  return invoke<void>('kill_dev_server');
}

export interface ParsedFile {
  frontmatter: any;
  code: string;
}

export async function scanProjectDirectory(path: string): Promise<FileInfo[]> {
  return invoke<FileInfo[]>('scan_project_directory', { path });
}

export async function readComponentFile(path: string): Promise<string> {
  return invoke<string>('read_component_file', { path });
}

export async function parseComponentFile(content: string): Promise<ParsedFile> {
  return invoke<ParsedFile>('parse_component_file', { content });
}

export async function updateTokens(filePath: string, tokens: Record<string, string>): Promise<void> {
  const tokensJson = JSON.stringify(tokens);
  return invoke<void>('update_tokens', { filePath, tokensJson });
}

export interface GlobalConfig {
  name: string;
  version: string;
  tokens: {
    colors: Record<string, string>;
    spacing: Record<string, string>;
    rounded: Record<string, string>;
    fontSize: Record<string, string>;
  };
}

export async function loadGlobalConfig(projectRoot: string): Promise<GlobalConfig> {
  return invoke<GlobalConfig>('load_global_config', { projectRoot });
}

export async function createVariant(
  componentDirectory: string,
  componentName: string,
  variantName: string,
  tokens?: Record<string, string>,
  description?: string,
): Promise<string> {
  const tokensJson = tokens ? JSON.stringify(tokens) : undefined;
  return invoke<string>('create_variant', {
    componentDirectory,
    componentName,
    variantName,
    tokensJson,
    description,
  });
}

export async function writeComponentFile(filePath: string, content: string): Promise<void> {
  return invoke<void>('write_component_file', { filePath, content });
}

export async function readDesignDoc(projectRoot: string): Promise<string> {
  return invoke<string>('read_component_file', { path: `${projectRoot}/design.md` });
}

export async function writeDesignDoc(projectRoot: string, content: string): Promise<void> {
  return invoke<void>('write_component_file', { filePath: `${projectRoot}/design.md`, content });
}

export interface DuplicateToken {
  value: string;
  property: string;
  occurrences: { component_name: string; variant_name: string; file_path: string }[];
  suggested_token_name: string;
}

export interface StructureDuplicate {
  pattern: string;
  occurrences: string[];
  suggestion: string;
}

export async function analyzeDuplicates(componentsJson: string): Promise<DuplicateToken[]> {
  return invoke<DuplicateToken[]>('analyze_duplicates', { componentsJson });
}

export async function analyzeStructure(componentsJson: string): Promise<StructureDuplicate[]> {
  return invoke<StructureDuplicate[]>('analyze_structure', { componentsJson });
}

export async function buildPackage(projectRoot: string, packageName: string, componentsJson: string): Promise<string> {
  return invoke<string>('build_package', { projectRoot, packageName, componentsJson });
}

export async function watchProject(projectRoot: string): Promise<void> {
  return invoke<void>('watch_project', { projectRoot });
}

// DTCG (W3C Design Tokens) export
export function exportDTCG(config: GlobalConfig): string {
  const dtcg: Record<string, any> = {};

  for (const [name, value] of Object.entries(config.tokens.colors)) {
    dtcg[`color-${name}`] = { $type: 'color', $value: value };
  }
  for (const [name, value] of Object.entries(config.tokens.spacing)) {
    dtcg[`spacing-${name}`] = { $type: 'dimension', $value: value };
  }
  for (const [name, value] of Object.entries(config.tokens.rounded)) {
    dtcg[`radius-${name}`] = { $type: 'dimension', $value: value };
  }
  for (const [name, value] of Object.entries(config.tokens.fontSize)) {
    dtcg[`fontSize-${name}`] = { $type: 'dimension', $value: value };
  }

  return JSON.stringify(dtcg, null, 2);
}

export async function loadProject(rootPath: string): Promise<ProjectStructure> {
  const normalizedRoot = rootPath.replace(/\\/g, '/');

  const manifest = await readManifest(normalizedRoot);

  const components: Component[] = [];

  for (const mc of manifest.components) {
    const componentDir = `${normalizedRoot}/${mc.directory}`.replace(/\/+/g, '/');
    const variants: import('../types/component').ComponentVariant[] = [];

    for (const mv of mc.variants) {
      const fullFilePath = `${normalizedRoot}/${mv.file}`.replace(/\/+/g, '/');
      const fullDocPath = `${normalizedRoot}/${mv.doc}`.replace(/\/+/g, '/');

      let parsed: { frontmatter: any; code: string } = { frontmatter: null, code: '' };
      let missing = false;
      try {
        const tsxContent = await readComponentFile(fullFilePath);
        parsed = await parseComponentFile(tsxContent);
      } catch (err) {
        console.warn(`Variant file missing or unreadable: ${fullFilePath}`, err);
        missing = true;
      }

      let docContent = '';
      try {
        docContent = await readComponentFile(fullDocPath);
      } catch {
        // Doc doesn't exist yet — seed it.
        const description = typeof parsed.frontmatter?.description === 'string'
          ? parsed.frontmatter.description
          : undefined;
        const usage = typeof parsed.frontmatter?.usage === 'string'
          ? parsed.frontmatter.usage
          : undefined;
        docContent = seedDocTemplate(mc.name, mv.name, description, usage);
        try {
          await writeComponentFile(fullDocPath, docContent);
        } catch (writeErr) {
          console.error(`Failed to seed doc at ${fullDocPath}:`, writeErr);
        }
      }

      variants.push({
        filePath: fullFilePath,
        variantName: mv.name,
        frontmatter: parsed.frontmatter,
        code: parsed.code,
        docPath: fullDocPath,
        docContent,
        missing,
      });
    }

    components.push({
      name: mc.name,
      directory: componentDir,
      variants,
    });
  }

  return {
    rootPath: normalizedRoot,
    components,
    blocks: [], // Blocks are out of scope for v1 manifest; legacy callers won't depend on this list.
  };
}

function seedDocTemplate(componentName: string, variantName: string, description?: string, usage?: string): string {
  const heading = `# ${componentName} · ${variantName}`;
  if (!description && !usage) {
    return `${heading}\n`;
  }
  const descBlock = description ? `\n${description.trim()}\n` : '';
  const usageText = usage?.trim() || 'Document when and how to use this variant.';
  return `${heading}\n${descBlock}\n## Usage\n\n${usageText}\n`;
}

export async function readManifest(projectRoot: string): Promise<Manifest> {
  return invoke<Manifest>('read_manifest', { projectRoot });
}

export async function writeManifest(projectRoot: string, manifest: Manifest): Promise<void> {
  return invoke<void>('write_manifest', {
    projectRoot,
    manifestJson: JSON.stringify(manifest),
  });
}
