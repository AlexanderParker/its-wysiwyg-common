/**
 * TypeScript model of the Instruction Template Specification (ITS) v1.0.
 * These types are self-contained so the editor has no dependency on any
 * compiler implementation.
 *
 * Spec: https://alexanderparker.github.io/instruction-template-specification/
 */

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface TextElement {
  type: "text";
  text: string;
  id?: string;
}

export interface PlaceholderElement {
  type: "placeholder";
  instructionType: string;
  config: PlaceholderConfig;
  id?: string;
}

export interface PlaceholderConfig {
  description: string;
  displayName?: string;
  [key: string]: JsonValue | undefined;
}

export interface ConditionalElement {
  type: "conditional";
  condition: string;
  content: ContentElement[];
  else?: ContentElement[];
  id?: string;
}

export type ContentElement = TextElement | PlaceholderElement | ConditionalElement;

export interface TemplateMetadata {
  name?: string;
  description?: string;
  author?: string;
  tags?: string[];
  [key: string]: JsonValue | undefined;
}

export interface InstructionTypeDefinition {
  template: string;
  description?: string;
  configSchema?: ConfigSchema;
}

export interface ConfigSchema {
  type?: "object";
  properties?: Record<string, ConfigPropertySchema>;
  required?: string[];
}

export interface ConfigPropertySchema {
  type?: "string" | "integer" | "number" | "boolean";
  enum?: Array<string | number>;
  default?: JsonValue;
  minimum?: number;
  maximum?: number;
  description?: string;
}

export interface ItsTemplate {
  $schema?: string;
  version: string;
  extends?: string[];
  metadata?: TemplateMetadata;
  variables?: Record<string, JsonValue>;
  customInstructionTypes?: Record<string, InstructionTypeDefinition>;
  compilerConfig?: Record<string, JsonValue>;
  content: ContentElement[];
}

export interface TemplateEditorProps {
  /** The template being edited. The editor is fully controlled. */
  value: ItsTemplate;
  /** Called with a new template object on every edit. */
  onChange: (template: ItsTemplate) => void;
  /**
   * Instruction type definitions available in the placeholder palette,
   * typically the ITS standard types plus any organisation-specific types.
   * Types declared in the template's own customInstructionTypes are merged
   * on top of these automatically.
   */
  instructionTypes?: Record<string, InstructionTypeDefinition>;
  /**
   * Known extendable schemas offered by the Metadata tab's per-schema
   * selects; templates can still extend any custom URL. Supplied by the
   * host - the editor never fetches.
   */
  schemaOptions?: SchemaOption[];
  /** Hide the JSON source tab if the host app provides its own. */
  showJsonTab?: boolean;
  /** Optional extra class name on the editor root. */
  className?: string;
}

export interface SchemaOption {
  /** Display label, e.g. "Standard types". */
  label: string;
  /** The published schema URL written into the template's extends. */
  url: string;
}
