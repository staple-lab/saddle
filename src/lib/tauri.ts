import { invoke } from '@tauri-apps/api/core';
import type { Component, ProjectStructure } from '../types/component';

export interface FileInfo {
  path: string;
  name: string;
  is_dir: boolean;
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

export async function loadProject(
  rootPath: string,
  componentPath: string = 'src/components',
  extensions: string[] = ['.tsx', '.jsx']
): Promise<ProjectStructure> {
  // Normalize paths
  const normalizedRoot = rootPath.replace(/\\/g, '/');
  const normalizedComponentPath = componentPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const fullComponentPath = `${normalizedRoot}/${normalizedComponentPath}`.replace(/\/+/g, '/');

  const files = await scanProjectDirectory(rootPath);

  console.log('=== Load Project Debug ===');
  console.log('Total files scanned:', files.length);
  console.log('Root path:', normalizedRoot);
  console.log('Component path:', normalizedComponentPath);
  console.log('Full component path:', fullComponentPath);
  console.log('Extensions:', extensions);
  console.log('All scanned files:', files.map(f => ({ path: f.path, name: f.name, isDir: f.is_dir })));

  // Find component directories within the specified path
  const componentDirs = files.filter(f => {
    const normalizedFilePath = f.path.replace(/\\/g, '/');
    const isDir = f.is_dir;

    if (!isDir) return false;

    // Must be inside the component path
    if (!normalizedFilePath.startsWith(fullComponentPath)) return false;

    // Must be a direct child directory (not the root itself)
    const relativePath = normalizedFilePath.slice(fullComponentPath.length).replace(/^\/+/, '');
    const isDirectChild = relativePath.length > 0 && !relativePath.includes('/');

    console.log('Dir check:', f.name, 'relative:', relativePath, 'isDirectChild:', isDirectChild);

    return isDirectChild;
  });

  console.log('Component directories found:', componentDirs.length);
  componentDirs.forEach(d => console.log('  -', d.name, 'at', d.path));

  const components: Component[] = [];

  for (const dir of componentDirs) {
    const dirPath = dir.path.replace(/\\/g, '/');
    const componentFiles = files.filter(f => {
      if (f.is_dir) return false;

      const filePath = f.path.replace(/\\/g, '/');

      // Must be directly in this component directory (not in subdirectories)
      if (!filePath.startsWith(dirPath + '/')) return false;

      const relativePath = filePath.slice(dirPath.length + 1);
      if (relativePath.includes('/')) return false; // Ignore nested files

      return extensions.some(ext => f.name.endsWith(ext));
    });

    console.log(`Files in ${dir.name}:`, componentFiles.length, componentFiles.map(f => f.name));

    const variantResults = await Promise.all(
      componentFiles.map(async (file) => {
        try {
          const content = await readComponentFile(file.path);
          const parsed = await parseComponentFile(content);

          // Extract variant name from filename (e.g., "Button.Primary.tsx" -> "Primary")
          const fileNameParts = file.name.replace(/\.(tsx|jsx|ts|js)$/, '').split('.');
          const variantName = fileNameParts.length > 1 ? fileNameParts[fileNameParts.length - 1] : 'Default';

          return {
            filePath: file.path,
            variantName,
            frontmatter: parsed.frontmatter,
            code: parsed.code,
          };
        } catch (err) {
          console.warn(`Skipping ${file.path}:`, err);
          return null;
        }
      })
    );
    const variants = variantResults.filter((v): v is NonNullable<typeof v> => v !== null);

    components.push({
      name: dir.name,
      directory: dir.path,
      variants,
    });
  }

  console.log('Total components loaded:', components.length);

  // Scan for blocks (directories under src/blocks or blocks/)
  const blocks: import('../types/component').Block[] = [];
  const blockDirs = files.filter(f => {
    const normalizedFilePath = f.path.replace(/\\/g, '/');
    return f.is_dir && (normalizedFilePath.includes('/blocks/') && !normalizedFilePath.endsWith('/blocks'));
  });

  for (const dir of blockDirs) {
    const propsFile = files.find(f => !f.is_dir && f.path.startsWith(dir.path) && f.name.endsWith('.props.json'));
    let props: Record<string, string> = {};
    if (propsFile) {
      try {
        const propsContent = await readComponentFile(propsFile.path);
        props = JSON.parse(propsContent);
      } catch {}
    }

    // Read block file to find composed components
    const blockFile = files.find(f => !f.is_dir && f.path.startsWith(dir.path) && (f.name.endsWith('.tsx') || f.name.endsWith('.jsx')));
    let composedComponents: string[] = [];
    if (blockFile) {
      try {
        const content = await readComponentFile(blockFile.path);
        const importMatches = content.match(/import.*from.*['"]\.\.\/(components|\.\.\/components)\/(\w+)/g);
        if (importMatches) {
          composedComponents = importMatches.map(m => {
            const match = m.match(/\/(\w+)['"]/);
            return match ? match[1] : '';
          }).filter(Boolean);
        }
      } catch {}
    }

    blocks.push({
      name: dir.name,
      directory: dir.path,
      components: composedComponents,
      propsFile: propsFile?.path || '',
      props,
    });
  }

  return {
    rootPath,
    components,
    blocks,
  };
}
