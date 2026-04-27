// Complete CSS property catalog with type information
import type { TokenSlot } from '../tokens/tokens';

export type CSSPropertyType = 'color' | 'length' | 'percentage' | 'number' | 'keyword' | 'custom';

export type CSSPropertyDef = {
  name: string;
  types: CSSPropertyType[];
  tokenSlot?: TokenSlot;
  keywords?: string[];
  allowsMultiple?: boolean;
};

// Comprehensive CSS property definitions
export const CSS_PROPERTIES: Record<string, CSSPropertyDef> = {
  // Colors
  'color': { name: 'color', types: ['color'], tokenSlot: 'color' },
  'background-color': { name: 'background-color', types: ['color'], tokenSlot: 'color' },
  'backgroundColor': { name: 'backgroundColor', types: ['color'], tokenSlot: 'color' },
  'border-color': { name: 'border-color', types: ['color'], tokenSlot: 'color' },
  'borderColor': { name: 'borderColor', types: ['color'], tokenSlot: 'color' },
  'outline-color': { name: 'outline-color', types: ['color'], tokenSlot: 'color' },
  'text-decoration-color': { name: 'text-decoration-color', types: ['color'], tokenSlot: 'color' },

  // Spacing - Padding
  'padding': { name: 'padding', types: ['length'], tokenSlot: 'space', allowsMultiple: true },
  'padding-top': { name: 'padding-top', types: ['length'], tokenSlot: 'space' },
  'paddingTop': { name: 'paddingTop', types: ['length'], tokenSlot: 'space' },
  'padding-right': { name: 'padding-right', types: ['length'], tokenSlot: 'space' },
  'paddingRight': { name: 'paddingRight', types: ['length'], tokenSlot: 'space' },
  'padding-bottom': { name: 'padding-bottom', types: ['length'], tokenSlot: 'space' },
  'paddingBottom': { name: 'paddingBottom', types: ['length'], tokenSlot: 'space' },
  'padding-left': { name: 'padding-left', types: ['length'], tokenSlot: 'space' },
  'paddingLeft': { name: 'paddingLeft', types: ['length'], tokenSlot: 'space' },

  // Spacing - Margin
  'margin': { name: 'margin', types: ['length'], tokenSlot: 'space', allowsMultiple: true },
  'margin-top': { name: 'margin-top', types: ['length'], tokenSlot: 'space' },
  'marginTop': { name: 'marginTop', types: ['length'], tokenSlot: 'space' },
  'margin-right': { name: 'margin-right', types: ['length'], tokenSlot: 'space' },
  'marginRight': { name: 'marginRight', types: ['length'], tokenSlot: 'space' },
  'margin-bottom': { name: 'margin-bottom', types: ['length'], tokenSlot: 'space' },
  'marginBottom': { name: 'marginBottom', types: ['length'], tokenSlot: 'space' },
  'margin-left': { name: 'margin-left', types: ['length'], tokenSlot: 'space' },
  'marginLeft': { name: 'marginLeft', types: ['length'], tokenSlot: 'space' },

  // Spacing - Gap
  'gap': { name: 'gap', types: ['length'], tokenSlot: 'space' },
  'row-gap': { name: 'row-gap', types: ['length'], tokenSlot: 'space' },
  'rowGap': { name: 'rowGap', types: ['length'], tokenSlot: 'space' },
  'column-gap': { name: 'column-gap', types: ['length'], tokenSlot: 'space' },
  'columnGap': { name: 'columnGap', types: ['length'], tokenSlot: 'space' },

  // Border Radius
  'border-radius': { name: 'border-radius', types: ['length'], tokenSlot: 'radius', allowsMultiple: true },
  'borderRadius': { name: 'borderRadius', types: ['length'], tokenSlot: 'radius', allowsMultiple: true },
  'border-top-left-radius': { name: 'border-top-left-radius', types: ['length'], tokenSlot: 'radius' },
  'borderTopLeftRadius': { name: 'borderTopLeftRadius', types: ['length'], tokenSlot: 'radius' },
  'border-top-right-radius': { name: 'border-top-right-radius', types: ['length'], tokenSlot: 'radius' },
  'borderTopRightRadius': { name: 'borderTopRightRadius', types: ['length'], tokenSlot: 'radius' },
  'border-bottom-right-radius': { name: 'border-bottom-right-radius', types: ['length'], tokenSlot: 'radius' },
  'borderBottomRightRadius': { name: 'borderBottomRightRadius', types: ['length'], tokenSlot: 'radius' },
  'border-bottom-left-radius': { name: 'border-bottom-left-radius', types: ['length'], tokenSlot: 'radius' },
  'borderBottomLeftRadius': { name: 'borderBottomLeftRadius', types: ['length'], tokenSlot: 'radius' },

  // Typography
  'font-family': { name: 'font-family', types: ['custom'], tokenSlot: 'fontFamily' },
  'fontFamily': { name: 'fontFamily', types: ['custom'], tokenSlot: 'fontFamily' },
  'font-size': { name: 'font-size', types: ['length'], tokenSlot: 'fontSize' },
  'fontSize': { name: 'fontSize', types: ['length'], tokenSlot: 'fontSize' },
  'font-weight': { name: 'font-weight', types: ['number', 'keyword'], tokenSlot: 'fontWeight' },
  'fontWeight': { name: 'fontWeight', types: ['number', 'keyword'], tokenSlot: 'fontWeight' },
  'letter-spacing': { name: 'letter-spacing', types: ['length'], tokenSlot: 'letterSpacing' },
  'letterSpacing': { name: 'letterSpacing', types: ['length'], tokenSlot: 'letterSpacing' },

  // Border Width
  'border-width': { name: 'border-width', types: ['length'], allowsMultiple: true },
  'borderWidth': { name: 'borderWidth', types: ['length'], allowsMultiple: true },
  'border-top-width': { name: 'border-top-width', types: ['length'] },
  'borderTopWidth': { name: 'borderTopWidth', types: ['length'] },
  'border-right-width': { name: 'border-right-width', types: ['length'] },
  'borderRightWidth': { name: 'borderRightWidth', types: ['length'] },
  'border-bottom-width': { name: 'border-bottom-width', types: ['length'] },
  'borderBottomWidth': { name: 'borderBottomWidth', types: ['length'] },
  'border-left-width': { name: 'border-left-width', types: ['length'] },
  'borderLeftWidth': { name: 'borderLeftWidth', types: ['length'] },

  // Other length properties
  'width': { name: 'width', types: ['length', 'percentage'] },
  'height': { name: 'height', types: ['length', 'percentage'] },
  'min-width': { name: 'min-width', types: ['length', 'percentage'] },
  'minWidth': { name: 'minWidth', types: ['length', 'percentage'] },
  'max-width': { name: 'max-width', types: ['length', 'percentage'] },
  'maxWidth': { name: 'maxWidth', types: ['length', 'percentage'] },
  'min-height': { name: 'min-height', types: ['length', 'percentage'] },
  'minHeight': { name: 'minHeight', types: ['length', 'percentage'] },
  'max-height': { name: 'max-height', types: ['length', 'percentage'] },
  'maxHeight': { name: 'maxHeight', types: ['length', 'percentage'] },

  // Line height
  'line-height': { name: 'line-height', types: ['number', 'length'], tokenSlot: 'lineHeight' },
  'lineHeight': { name: 'lineHeight', types: ['number', 'length'], tokenSlot: 'lineHeight' },

  // Opacity
  'opacity': { name: 'opacity', types: ['number'] },

  // Z-index
  'z-index': { name: 'z-index', types: ['number'] },
  'zIndex': { name: 'zIndex', types: ['number'] },
};

/**
 * Lookup CSS property definition
 */
export function getPropertyDef(propertyName: string): CSSPropertyDef | null {
  return CSS_PROPERTIES[propertyName] || null;
}

/**
 * Detect token slot for a property
 */
export function detectTokenSlot(propertyName: string, value?: string): TokenSlot | null {
  const def = getPropertyDef(propertyName);
  if (def?.tokenSlot) {
    return def.tokenSlot;
  }

  // Fallback: try to infer from value
  if (value) {
    if (value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl')) {
      return 'color';
    }
    if (value.startsWith('var(--color')) {
      return 'color';
    }
    if (value.startsWith('var(--spacing') || value.startsWith('var(--space')) {
      return 'space';
    }
    if (value.startsWith('var(--rounded') || value.startsWith('var(--radius')) {
      return 'radius';
    }
    if (value.startsWith('var(--font-size')) {
      return 'fontSize';
    }
    if (value.startsWith('var(--font-family')) {
      return 'fontFamily';
    }
    if (value.startsWith('var(--font-weight')) {
      return 'fontWeight';
    }
    if (value.startsWith('var(--line-height')) {
      return 'lineHeight';
    }
    if (value.startsWith('var(--letter-spacing')) {
      return 'letterSpacing';
    }
  }

  return null;
}
