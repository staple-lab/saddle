#!/usr/bin/env node

// MCP Bridge: Exposes Saddle's component tools to Claude Code via stdio MCP protocol
// Saddle app communicates with this bridge via a local HTTP endpoint

import { createInterface } from 'readline';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, basename, dirname } from 'path';
import { parse as parseYaml } from 'yaml'; // requires: npm install yaml

const rl = createInterface({ input: process.stdin });

let projectRoot = null;

function sendResponse(id, result) {
  const response = JSON.stringify({ jsonrpc: '2.0', id, result });
  process.stdout.write(`Content-Length: ${Buffer.byteLength(response)}\r\n\r\n${response}`);
}

function sendError(id, code, message) {
  const response = JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
  process.stdout.write(`Content-Length: ${Buffer.byteLength(response)}\r\n\r\n${response}`);
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: null, code: content };
  try {
    const frontmatter = parseYaml(match[1]);
    return { frontmatter, code: match[2] };
  } catch {
    return { frontmatter: null, code: content };
  }
}

function scanComponents(rootPath, componentPath) {
  const fullPath = join(rootPath, componentPath);
  const { readdirSync, statSync } = await import('fs');
  const dirs = readdirSync(fullPath).filter(f => statSync(join(fullPath, f)).isDirectory());

  return dirs.map(dirName => {
    const dirPath = join(fullPath, dirName);
    const files = readdirSync(dirPath).filter(f => f.endsWith('.tsx') || f.endsWith('.jsx'));

    const variants = files.map(fileName => {
      const filePath = join(dirPath, fileName);
      const content = readFileSync(filePath, 'utf-8');
      const { frontmatter, code } = parseFrontmatter(content);
      const parts = fileName.replace(/\.(tsx|jsx)$/, '').split('.');
      const variantName = parts.length > 1 ? parts[parts.length - 1] : 'Default';

      return {
        name: variantName,
        file_path: filePath,
        tokens: frontmatter?.tokens || {},
        props: frontmatter?.props || [],
        description: frontmatter?.description || null,
        usage: frontmatter?.usage || null,
      };
    });

    return { name: dirName, directory: dirPath, variants };
  });
}

function handleRequest(request) {
  const { id, method, params } = request;

  switch (method) {
    case 'initialize':
      sendResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'saddle', version: '0.1.0' },
      });
      break;

    case 'tools/list':
      sendResponse(id, {
        tools: [
          {
            name: 'saddle_list_components',
            description: 'List all components in the Saddle project with variants and metadata',
            inputSchema: { type: 'object', properties: { project_root: { type: 'string' }, component_path: { type: 'string', default: 'src/components' } }, required: ['project_root'] },
          },
          {
            name: 'saddle_get_component',
            description: 'Get full details for a component including all variants, tokens, props, and usage guidelines',
            inputSchema: { type: 'object', properties: { project_root: { type: 'string' }, component_path: { type: 'string', default: 'src/components' }, component_name: { type: 'string' } }, required: ['project_root', 'component_name'] },
          },
          {
            name: 'saddle_update_tokens',
            description: 'Update design tokens in a component variant frontmatter. Changes are saved to the file immediately.',
            inputSchema: { type: 'object', properties: { file_path: { type: 'string' }, tokens: { type: 'object' } }, required: ['file_path', 'tokens'] },
          },
          {
            name: 'saddle_read_component',
            description: 'Read full source code of a component file including design.md frontmatter',
            inputSchema: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] },
          },
          {
            name: 'saddle_create_variant',
            description: 'Create a new variant file with frontmatter and boilerplate code',
            inputSchema: {
              type: 'object',
              properties: {
                component_directory: { type: 'string' },
                component_name: { type: 'string' },
                variant_name: { type: 'string' },
                tokens: { type: 'object' },
                description: { type: 'string' },
              },
              required: ['component_directory', 'component_name', 'variant_name'],
            },
          },
          {
            name: 'saddle_get_global_tokens',
            description: 'Read global design tokens from saddle.config.json',
            inputSchema: { type: 'object', properties: { project_root: { type: 'string' } }, required: ['project_root'] },
          },
        ],
      });
      break;

    case 'tools/call': {
      const toolName = params?.name;
      const args = params?.arguments || {};

      try {
        switch (toolName) {
          case 'saddle_list_components': {
            const components = scanComponents(args.project_root, args.component_path || 'src/components');
            sendResponse(id, { content: [{ type: 'text', text: JSON.stringify(components, null, 2) }] });
            break;
          }
          case 'saddle_get_component': {
            const components = scanComponents(args.project_root, args.component_path || 'src/components');
            const comp = components.find(c => c.name === args.component_name);
            if (!comp) {
              sendResponse(id, { content: [{ type: 'text', text: `Component "${args.component_name}" not found` }], isError: true });
            } else {
              sendResponse(id, { content: [{ type: 'text', text: JSON.stringify(comp, null, 2) }] });
            }
            break;
          }
          case 'saddle_read_component': {
            const content = readFileSync(args.file_path, 'utf-8');
            sendResponse(id, { content: [{ type: 'text', text: content }] });
            break;
          }
          case 'saddle_update_tokens': {
            const content = readFileSync(args.file_path, 'utf-8');
            const parts = content.split('---');
            if (parts.length < 3) {
              sendResponse(id, { content: [{ type: 'text', text: 'Invalid frontmatter format' }], isError: true });
              break;
            }
            const frontmatter = parseYaml(parts[1]);
            frontmatter.tokens = { ...(frontmatter.tokens || {}), ...args.tokens };
            const yamlStr = Object.entries(frontmatter)
              .map(([k, v]) => {
                if (typeof v === 'object' && !Array.isArray(v)) {
                  const inner = Object.entries(v).map(([ik, iv]) => `  ${ik}: "${iv}"`).join('\n');
                  return `${k}:\n${inner}`;
                }
                if (Array.isArray(v)) {
                  return `${k}:\n${v.map(i => `  - ${typeof i === 'string' ? i : JSON.stringify(i)}`).join('\n')}`;
                }
                if (typeof v === 'string' && v.includes('\n')) {
                  return `${k}: |\n  ${v.replace(/\n/g, '\n  ')}`;
                }
                return `${k}: ${v}`;
              })
              .join('\n');
            const newContent = `---\n${yamlStr}\n---${parts.slice(2).join('---')}`;
            writeFileSync(args.file_path, newContent);
            sendResponse(id, { content: [{ type: 'text', text: `Updated tokens in ${basename(args.file_path)}` }] });
            break;
          }
          case 'saddle_create_variant': {
            const tokensYaml = args.tokens
              ? Object.entries(args.tokens).map(([k, v]) => `  ${k}: "${v}"`).join('\n')
              : '  backgroundColor: "#ffffff"';
            const desc = args.description || `${args.component_name} ${args.variant_name} variant`;
            const fileName = `${args.component_name}.${args.variant_name}.tsx`;
            const filePath = join(args.component_directory, fileName);
            const fileContent = `---\nname: ${args.component_name} ${args.variant_name}\ndescription: ${desc}\ntokens:\n${tokensYaml}\nprops:\n  - label: string\nusage: |\n  Describe when to use the ${args.variant_name} variant.\n---\n\nimport React from 'react';\n\ninterface Props {\n  label: string;\n}\n\nexport const ${args.component_name}${args.variant_name}: React.FC<Props> = ({ label }) => {\n  return (\n    <div>\n      {label}\n    </div>\n  );\n};\n`;
            writeFileSync(filePath, fileContent);
            sendResponse(id, { content: [{ type: 'text', text: `Created ${filePath}` }] });
            break;
          }
          case 'saddle_get_global_tokens': {
            const configPath = join(args.project_root, 'saddle.config.json');
            if (!existsSync(configPath)) {
              sendResponse(id, { content: [{ type: 'text', text: 'saddle.config.json not found' }], isError: true });
            } else {
              const config = JSON.parse(readFileSync(configPath, 'utf-8'));
              sendResponse(id, { content: [{ type: 'text', text: JSON.stringify(config.tokens, null, 2) }] });
            }
            break;
          }
          default:
            sendError(id, -32601, `Unknown tool: ${toolName}`);
        }
      } catch (err) {
        sendError(id, -32603, err.message);
      }
      break;
    }

    case 'notifications/initialized':
      break;

    default:
      if (id) sendError(id, -32601, `Unknown method: ${method}`);
  }
}

// Read Content-Length framed messages from stdin
let buffer = '';
process.stdin.on('data', (chunk) => {
  buffer += chunk.toString();

  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) break;

    const header = buffer.substring(0, headerEnd);
    const match = header.match(/Content-Length: (\d+)/);
    if (!match) {
      buffer = buffer.substring(headerEnd + 4);
      continue;
    }

    const contentLength = parseInt(match[1]);
    const contentStart = headerEnd + 4;

    if (buffer.length < contentStart + contentLength) break;

    const content = buffer.substring(contentStart, contentStart + contentLength);
    buffer = buffer.substring(contentStart + contentLength);

    try {
      const request = JSON.parse(content);
      handleRequest(request);
    } catch (err) {
      process.stderr.write(`Parse error: ${err.message}\n`);
    }
  }
});

process.stderr.write('Saddle MCP server started\n');
