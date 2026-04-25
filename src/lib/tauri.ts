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
