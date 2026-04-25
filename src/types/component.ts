export interface DesignToken {
  [key: string]: string;
}

export interface ComponentProp {
  name: string;
  type: string;
  required: boolean;
}

export interface ComponentFrontmatter {
  name: string;
  description: string;
  tokens: DesignToken;
  props: ComponentProp[];
  usage: string;
}

export interface ComponentVariant {
  filePath: string;
  variantName: string; // e.g., "Primary", "Secondary"
  frontmatter: ComponentFrontmatter | null;
  code: string;
}

export interface Component {
  name: string; // e.g., "Button"
  directory: string;
  variants: ComponentVariant[];
}

export interface ProjectStructure {
  rootPath: string;
  components: Component[];
}
