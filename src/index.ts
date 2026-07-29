export { TemplateEditor } from "./TemplateEditor";
export type {
  ConditionalElement,
  ConfigPropertySchema,
  ConfigSchema,
  ContentElement,
  InstructionTypeDefinition,
  ItsTemplate,
  JsonValue,
  PlaceholderConfig,
  PlaceholderElement,
  TemplateEditorProps,
  TemplateMetadata,
  TextElement,
} from "./types";
export {
  collectVariableReferences,
  findVariableReferences,
  isItsTemplateShape,
  renameInstructionTypeReferences,
  resolveInstructionTypes,
} from "./utils";
