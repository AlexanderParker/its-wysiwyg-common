import { createContext, useContext } from "react";
import type { InstructionTypeDefinition, JsonValue } from "./types";

export interface EditorContextValue {
  instructionTypes: Record<string, InstructionTypeDefinition>;
  variables: Record<string, JsonValue>;
  /**
   * The editor is showing the template rather than editing it. Panels can read
   * this to drop an affordance that a disabled control cannot express, such as
   * a drag handle. Nothing is required to consult it: the editor also disables
   * the controls themselves.
   */
  readOnly: boolean;
}

const EditorContext = createContext<EditorContextValue>({
  instructionTypes: {},
  variables: {},
  readOnly: false,
});

export const EditorContextProvider = EditorContext.Provider;

export function useEditorContext(): EditorContextValue {
  return useContext(EditorContext);
}
