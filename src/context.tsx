import { createContext, useContext } from "react";
import type { InstructionTypeDefinition, JsonValue } from "./types";

export interface EditorContextValue {
  instructionTypes: Record<string, InstructionTypeDefinition>;
  variables: Record<string, JsonValue>;
}

const EditorContext = createContext<EditorContextValue>({ instructionTypes: {}, variables: {} });

export const EditorContextProvider = EditorContext.Provider;

export function useEditorContext(): EditorContextValue {
  return useContext(EditorContext);
}
