import { createContext, useContext } from "react";
import type { InstructionTypeDefinition } from "./types";

export interface EditorContextValue {
  instructionTypes: Record<string, InstructionTypeDefinition>;
}

const EditorContext = createContext<EditorContextValue>({ instructionTypes: {} });

export const EditorContextProvider = EditorContext.Provider;

export function useEditorContext(): EditorContextValue {
  return useContext(EditorContext);
}
