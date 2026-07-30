import { Fragment } from "react";
import { useEditorContext } from "../context";
import {
  jsonStructureGroupId,
  newJsonStructureGroupId,
  parseJsonStructure,
  serialiseJsonStructure,
  type JsonStructure,
} from "../jsonStructure";
import type { ConditionalElement, ContentElement, PlaceholderElement, TextElement } from "../types";
import { insertAt, moveItem, nextElementId, removeAt, replaceAt } from "../utils";
import { AddBlockMenu } from "./AddBlockMenu";
import { BlockFrame } from "./BlockFrame";
import { ConfigForm } from "./ConfigForm";
import { JsonStructureBlock } from "./JsonStructureBlock";

interface BlockListProps {
  elements: ContentElement[];
  onChange: (elements: ContentElement[]) => void;
  depth?: number;
}

/**
 * Elements whose ids share a jsb-<groupId>- prefix and parse as a JSON
 * structure are edited as one builder block; everything else is a single
 * block. Slots are the editing units the list renders and reorders.
 */
type Slot =
  | { kind: "single"; element: ContentElement }
  | { kind: "json"; groupId: string; structure: JsonStructure; elements: ContentElement[] };

function computeSlots(elements: ContentElement[]): Slot[] {
  const slots: Slot[] = [];
  let index = 0;
  while (index < elements.length) {
    const groupId = jsonStructureGroupId(elements[index].id);
    if (groupId !== null) {
      let end = index;
      while (end < elements.length && jsonStructureGroupId(elements[end].id) === groupId) end += 1;
      const run = elements.slice(index, end);
      const structure = parseJsonStructure(run);
      if (structure !== null) {
        slots.push({ kind: "json", groupId, structure, elements: run });
        index = end;
        continue;
      }
    }
    slots.push({ kind: "single", element: elements[index] });
    index += 1;
  }
  return slots;
}

function flattenSlots(slots: Slot[]): ContentElement[] {
  return slots.flatMap((slot) => (slot.kind === "single" ? [slot.element] : slot.elements));
}

export function BlockList({ elements, onChange, depth = 0 }: BlockListProps): JSX.Element {
  const slots = computeSlots(elements);

  const commit = (nextSlots: Slot[]): void => onChange(flattenSlots(nextSlots));

  const duplicateSlot = (index: number): void => {
    const source = slots[index];
    if (source.kind === "single") {
      const copy = JSON.parse(JSON.stringify(source.element)) as ContentElement;
      copy.id = nextElementId(copy.type);
      commit(insertAt(slots, index + 1, { kind: "single", element: copy }));
    } else {
      const groupId = newJsonStructureGroupId();
      commit(
        insertAt(slots, index + 1, {
          kind: "json",
          groupId,
          structure: source.structure,
          elements: serialiseJsonStructure(source.structure, groupId),
        }),
      );
    }
  };

  return (
    <div className={depth === 0 ? "its-blocklist" : "its-blocklist its-blocklist--nested"}>
      {elements.length === 0 && (
        <p className="its-blocklist__empty">
          {depth === 0
            ? "This template is empty. Add a text block to write static content, a placeholder to insert an AI instruction, or a JSON structure to build a structured response."
            : "This branch is empty."}
        </p>
      )}
      {slots.map((slot, index) => {
        const shared = {
          onMoveUp: (): void => commit(moveItem(slots, index, index - 1)),
          onMoveDown: (): void => commit(moveItem(slots, index, index + 1)),
          onDuplicate: (): void => duplicateSlot(index),
          onDelete: (): void => commit(removeAt(slots, index)),
          canMoveUp: index > 0,
          canMoveDown: index < slots.length - 1,
        };
        if (slot.kind === "json") {
          return (
            <Fragment key={`json-${slot.groupId}`}>
              <JsonStructureBlock
                structure={slot.structure}
                onChange={(structure) =>
                  commit(
                    replaceAt(slots, index, {
                      kind: "json",
                      groupId: slot.groupId,
                      structure,
                      elements: serialiseJsonStructure(structure, slot.groupId),
                    }),
                  )
                }
                {...shared}
              />
            </Fragment>
          );
        }
        const element = slot.element;
        return (
          <Fragment key={element.id ?? `${element.type}-${index}`}>
            <Block
              element={element}
              onChange={(updated) => commit(replaceAt(slots, index, { kind: "single", element: updated }))}
              depth={depth}
              {...shared}
            />
          </Fragment>
        );
      })}
      <AddBlockMenu
        compact={depth > 0}
        onAdd={(element) => onChange([...elements, element])}
        onAddGroup={(group) => onChange([...elements, ...group])}
      />
    </div>
  );
}

interface BlockProps {
  element: ContentElement;
  onChange: (element: ContentElement) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  depth: number;
}

function Block(props: BlockProps): JSX.Element {
  const { element } = props;
  if (element.type === "text") {
    return <TextBlock {...props} element={element} />;
  }
  if (element.type === "placeholder") {
    return <PlaceholderBlock {...props} element={element} />;
  }
  return <ConditionalBlock {...props} element={element} />;
}

function TextBlock(props: BlockProps & { element: TextElement }): JSX.Element {
  const { element, onChange } = props;
  return (
    <BlockFrame kind="text" label="Text" {...frameProps(props)}>
      <textarea
        className="its-textarea"
        rows={Math.min(10, Math.max(2, element.text.split("\n").length))}
        value={element.text}
        placeholder={'Static content. Reference variables with ${name}. Use \\n via real line breaks.'}
        onChange={(event) => onChange({ ...element, text: event.target.value })}
      />
    </BlockFrame>
  );
}

function PlaceholderBlock(props: BlockProps & { element: PlaceholderElement }): JSX.Element {
  const { element, onChange } = props;
  const { instructionTypes } = useEditorContext();
  const definition = instructionTypes[element.instructionType];
  const knownType = definition !== undefined;

  return (
    <BlockFrame
      kind="placeholder"
      label={
        <>
          <span className="its-block__chevrons">&laquo;</span>
          <select
            className="its-block__typeselect"
            value={element.instructionType}
            onChange={(event) =>
              onChange({ ...element, instructionType: event.target.value })
            }
          >
            {!knownType && <option value={element.instructionType}>{element.instructionType} (unknown)</option>}
            {Object.keys(instructionTypes).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <span className="its-block__chevrons">&raquo;</span>
          {element.config.displayName && <span className="its-block__displayname">{element.config.displayName}</span>}
        </>
      }
      {...frameProps(props)}
    >
      {!knownType && (
        <p className="its-block__warning">
          No definition found for "{element.instructionType}". Add it to the template's custom instruction types, or
          extend a schema that defines it.
        </p>
      )}
      <ConfigForm definition={definition} config={element.config} onChange={(config) => onChange({ ...element, config })} />
    </BlockFrame>
  );
}

function ConditionalBlock(props: BlockProps & { element: ConditionalElement }): JSX.Element {
  const { element, onChange, depth } = props;
  const hasElse = element.else !== undefined;

  const toggleElse = (): void => {
    if (hasElse) {
      const next = { ...element };
      delete next.else;
      onChange(next);
    } else {
      onChange({ ...element, else: [] });
    }
  };

  return (
    <BlockFrame kind="conditional" label={<span>If</span>} {...frameProps(props)}>
      <input
        className="its-condition"
        type="text"
        value={element.condition}
        placeholder={"e.g. audienceLevel == 'technical' && featureCount > 3"}
        onChange={(event) => onChange({ ...element, condition: event.target.value })}
      />
      <div className="its-branch">
        <span className="its-branch__label">then</span>
        <BlockList elements={element.content} onChange={(content) => onChange({ ...element, content })} depth={depth + 1} />
      </div>
      {hasElse && (
        <div className="its-branch its-branch--else">
          <span className="its-branch__label">else</span>
          <BlockList
            elements={element.else ?? []}
            onChange={(elseContent) => onChange({ ...element, else: elseContent })}
            depth={depth + 1}
          />
        </div>
      )}
      <button type="button" className="its-branch__toggle" onClick={toggleElse}>
        {hasElse ? "Remove else branch" : "Add else branch"}
      </button>
    </BlockFrame>
  );
}

function frameProps(props: BlockProps): Omit<Parameters<typeof BlockFrame>[0], "kind" | "label" | "children"> {
  return {
    onMoveUp: props.onMoveUp,
    onMoveDown: props.onMoveDown,
    onDuplicate: props.onDuplicate,
    onDelete: props.onDelete,
    canMoveUp: props.canMoveUp,
    canMoveDown: props.canMoveDown,
  };
}
