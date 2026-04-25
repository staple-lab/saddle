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

export async function loadProject(rootPath: string): Promise<ProjectStructure> {
  const files = await scanProjectDirectory(rootPath);

  console.log('Total files scanned:', files.length);
  console.log('Root path:', rootPath);

  // Find component directories (look in src/components/ or components/)
  const componentDirs = files.filter(f => {
    const hasComponents = f.path.includes('/components/') || f.path.includes('\\components\\');
    const isDir = f.is_dir;
    const notComponentsDir = f.name !== 'components' && f.name !== 'src';
    return isDir && hasComponents && notComponentsDir;
  });

  console.log('Component directories found:', componentDirs.length, componentDirs.map(d => d.name));

  const components: Component[] = [];

  for (const dir of componentDirs) {
    const componentFiles = files.filter(f =>
      !f.is_dir &&
      f.path.startsWith(dir.path) &&
      f.name.endsWith('.tsx')
    );

    console.log(`Files in ${dir.name}:`, componentFiles.length, componentFiles.map(f => f.name));

    const variants = await Promise.all(
      componentFiles.map(async (file) => {
        const content = await readComponentFile(file.path);
        const parsed = await parseComponentFile(content);

        // Extract variant name from filename (e.g., "Button.Primary.tsx" -> "Primary")
        const fileNameParts = file.name.replace('.tsx', '').split('.');
        const variantName = fileNameParts.length > 1 ? fileNameParts[fileNameParts.length - 1] : 'Default';

        return {
          filePath: file.path,
          variantName,
          frontmatter: parsed.frontmatter,
          code: parsed.code,
        };
      })
    );

    components.push({
      name: dir.name,
      directory: dir.path,
      variants,
    });
  }

  console.log('Total components loaded:', components.length);

  return {
    rootPath,
    components,
  };
}
