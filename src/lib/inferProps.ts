// src/lib/inferProps.ts
// Lightweight, regex-based inference of a component's prop schema from its
// TSX source. Targets the class-variance-authority (cva) pattern plus common
// HTML attributes. Returns a list of typed prop definitions the Props panel
// can render as appropriate controls.

export type PropDef =
  | { name: string; kind: 'enum'; options: string[]; default?: string; source: 'cva' | 'manual' }
  | { name: string; kind: 'boolean'; default?: boolean; source: 'inferred' | 'manual' }
  | { name: string; kind: 'string'; default?: string; source: 'inferred' | 'manual' }
  | { name: string; kind: 'number'; default?: number; source: 'inferred' | 'manual' };

export interface PropSchema {
  /** Whether the source code looked cva-shaped — used to decide if we
   *  should also inject the common HTML-attr fallbacks. */
  detectedCva: boolean;
  props: PropDef[];
}

/**
 * Extract a prop schema from the variant's .tsx source.
 *
 * Strategy:
 *   1. Find the cva({...}) call and pull `variants` + `defaultVariants` blocks.
 *      Each top-level key in `variants` becomes an enum prop with the option
 *      keys as values; defaultVariants supplies the default.
 *   2. If the source mentions HTMLButtonElement / HTMLAnchorElement / etc.,
 *      add common boolean/string fallbacks the user is likely to want
 *      (children, disabled, aria-label).
 *   3. Always includes `children: string`.
 */
export function inferPropSchema(code: string): PropSchema {
  const props: PropDef[] = [];
  const cvaMatch = code.match(/cva\s*\(\s*[^,]+,\s*\{([\s\S]*?)\}\s*\)/);
  let detectedCva = false;

  if (cvaMatch) {
    detectedCva = true;
    const cvaBody = cvaMatch[1];

    // Extract variants block (greedy match within balanced-ish curlies).
    const variantsRaw = extractBlock(cvaBody, 'variants');
    if (variantsRaw) {
      // Each top-level key: identifier followed by ': {' starting a sub-block.
      const keyRegex = /(\w+)\s*:\s*\{/g;
      let m: RegExpExecArray | null;
      while ((m = keyRegex.exec(variantsRaw)) !== null) {
        const propName = m[1];
        // Find the matching closing brace for this sub-block.
        const startInner = m.index + m[0].length;
        const closeIdx = matchClosingBrace(variantsRaw, startInner);
        if (closeIdx < 0) continue;
        const inner = variantsRaw.slice(startInner, closeIdx);
        // Each option: identifier followed by ':' (we don't care about the value).
        const options: string[] = [];
        const optRegex = /(\w+)\s*:/g;
        let om: RegExpExecArray | null;
        while ((om = optRegex.exec(inner)) !== null) {
          options.push(om[1]);
        }
        if (options.length > 0) {
          props.push({ name: propName, kind: 'enum', options, source: 'cva' });
        }
      }
    }

    // Extract defaultVariants block and apply as defaults.
    const defaultsRaw = extractBlock(cvaBody, 'defaultVariants');
    if (defaultsRaw) {
      const defaultRegex = /(\w+)\s*:\s*['"]([^'"]+)['"]/g;
      let dm: RegExpExecArray | null;
      while ((dm = defaultRegex.exec(defaultsRaw)) !== null) {
        const name = dm[1];
        const value = dm[2];
        const target = props.find((p) => p.name === name && p.kind === 'enum');
        if (target && target.kind === 'enum') target.default = value;
      }
    }
  }

  // Common HTML-element fallbacks. We add these unconditionally because
  // children/disabled are useful on virtually any rendered component.
  const ensure = (name: string, def: PropDef) => {
    if (!props.some((p) => p.name === name)) props.push(def);
  };
  ensure('children', { name: 'children', kind: 'string', source: 'inferred', default: '' });
  if (/HTMLButtonElement|HTMLAnchorElement|HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement|disabled\s*\?/i.test(code)) {
    ensure('disabled', { name: 'disabled', kind: 'boolean', source: 'inferred', default: false });
    ensure('aria-label', { name: 'aria-label', kind: 'string', source: 'inferred', default: '' });
  }

  return { detectedCva, props };
}

/** Find a top-level `<keyword>: { ... }` block inside a TS object literal,
 *  using a small brace-balance scan. Returns the inner contents (without the
 *  outer braces) or null if not found. */
function extractBlock(body: string, keyword: string): string | null {
  const re = new RegExp(`(?:^|[\\s,{])${keyword}\\s*:\\s*\\{`, 'g');
  const m = re.exec(body);
  if (!m) return null;
  const start = m.index + m[0].length; // first char inside the block
  const end = matchClosingBrace(body, start);
  if (end < 0) return null;
  return body.slice(start, end);
}

/** Given a string and a start index immediately AFTER an opening `{`, return
 *  the index of the matching closing `}`, or -1 if not found. Treats string
 *  literals naively (good enough for TS object literals we care about). */
function matchClosingBrace(s: string, start: number): number {
  let depth = 1;
  let i = start;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    } else if (ch === "'" || ch === '"' || ch === '`') {
      // skip until matching quote (no escape handling beyond \\)
      const quote = ch;
      i++;
      while (i < s.length) {
        if (s[i] === '\\') { i += 2; continue; }
        if (s[i] === quote) { break; }
        i++;
      }
    }
    i++;
  }
  return -1;
}
