import { Fragment, useState } from "react";
import type { ReactNode } from "react";
import { useEditorContext } from "../context";
import {
  jsonStructureGroupId,
  newJsonStructureGroupId,
  parseJsonStructure,
  serialiseJsonStructure,
  type JsonStructure,
} from "../jsonStructure";
import {
  isHorizontalRuleText,
  markdownGroupOf,
  newMarkdownGroupId,
  parseHeadingText,
  parseMarkdownGroup,
  serialiseHeadingText,
  serialiseMarkdownGroup,
  type MarkdownGroupModel,
} from "../markdownStructure";
import type { ConditionalElement, ContentElement, PlaceholderElement, TextElement } from "../types";
import { insertAt, moveItem, nextElementId, removeAt, replaceAt, textLayout } from "../utils";
import { AddBlockMenu } from "./AddBlockMenu";
import { BlockActionsMenu, type BlockActions } from "./BlockActionsMenu";
import { ConfigForm } from "./ConfigForm";
import { JsonStructureBlock } from "./JsonStructureBlock";
import { MarkdownCodeEditor, MarkdownTableEditor } from "./MarkdownBlocks";
import { Modal } from "./Modal";
import { VariableField } from "./VariableField";

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
  | { kind: "json"; groupId: string; structure: JsonStructure; elements: ContentElement[] }
  | { kind: "markdown"; groupId: string; group: MarkdownGroupModel; elements: ContentElement[] };

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
    const mdGroup = markdownGroupOf(elements[index].id);
    if (mdGroup !== null) {
      let end = index;
      while (end < elements.length) {
        const next = markdownGroupOf(elements[end].id);
        if (next === null || next.group !== mdGroup.group || next.kind !== mdGroup.kind) break;
        end += 1;
      }
      const run = elements.slice(index, end);
      const group = parseMarkdownGroup(mdGroup.kind, run);
      if (group !== null) {
        slots.push({ kind: "markdown", groupId: mdGroup.group, group, elements: run });
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
  // The slot index where the add panel is open; blocks added there land at
  // exactly that position. slots.length means the trailing add trigger.
  const [insertIndex, setInsertIndex] = useState<number | null>(null);

  const commit = (nextSlots: Slot[]): void => onChange(flattenSlots(nextSlots));

  const insertElementAt = (index: number, element: ContentElement): void => {
    setInsertIndex(null);
    commit(insertAt(slots, index, { kind: "single", element }));
  };

  const insertGroupAt = (index: number, group: ContentElement[]): void => {
    setInsertIndex(null);
    const jsonGroupId = jsonStructureGroupId(group[0]?.id);
    const structure = jsonGroupId !== null ? parseJsonStructure(group) : null;
    if (jsonGroupId !== null && structure !== null) {
      commit(insertAt(slots, index, { kind: "json", groupId: jsonGroupId, structure, elements: group }));
      return;
    }
    const mdGroup = markdownGroupOf(group[0]?.id);
    const parsed = mdGroup !== null ? parseMarkdownGroup(mdGroup.kind, group) : null;
    if (mdGroup !== null && parsed !== null) {
      commit(insertAt(slots, index, { kind: "markdown", groupId: mdGroup.group, group: parsed, elements: group }));
      return;
    }
    const before = flattenSlots(slots.slice(0, index));
    const after = flattenSlots(slots.slice(index));
    onChange([...before, ...group, ...after]);
  };

  const duplicateSlot = (index: number): void => {
    const source = slots[index];
    if (source.kind === "single") {
      const copy = JSON.parse(JSON.stringify(source.element)) as ContentElement;
      copy.id = nextElementId(copy.type);
      commit(insertAt(slots, index + 1, { kind: "single", element: copy }));
    } else if (source.kind === "json") {
      const groupId = newJsonStructureGroupId();
      commit(
        insertAt(slots, index + 1, {
          kind: "json",
          groupId,
          structure: source.structure,
          elements: serialiseJsonStructure(source.structure, groupId),
        }),
      );
    } else {
      const groupId = newMarkdownGroupId();
      commit(
        insertAt(slots, index + 1, {
          kind: "markdown",
          groupId,
          group: source.group,
          elements: serialiseMarkdownGroup(source.group, groupId),
        }),
      );
    }
  };

  const insertionPoint = (index: number): JSX.Element | null =>
    insertIndex === index ? (
      <AddBlockMenu
        compact={depth > 0}
        open
        showTrigger={false}
        onToggle={(next) => setInsertIndex(next ? index : null)}
        onAdd={(element) => insertElementAt(index, element)}
        onAddGroup={(group) => insertGroupAt(index, group)}
      />
    ) : null;

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
        const shared: BlockActions = {
          onMoveUp: (): void => commit(moveItem(slots, index, index - 1)),
          onMoveDown: (): void => commit(moveItem(slots, index, index + 1)),
          onInsertBefore: (): void => setInsertIndex(index),
          onInsertAfter: (): void => setInsertIndex(index + 1),
          onDuplicate: (): void => duplicateSlot(index),
          onDelete: (): void => commit(removeAt(slots, index)),
          canMoveUp: index > 0,
          canMoveDown: index < slots.length - 1,
        };
        if (slot.kind === "markdown") {
          const group = slot.group;
          return (
            <Fragment key={`md-${slot.groupId}`}>
              {insertionPoint(index)}
              <FlowBlock
                {...({ element: slot.elements[0], onChange: () => undefined, depth, ...shared } as BlockProps)}
                kind="text"
              >
                {group.kind === "code" ? (
                  <MarkdownCodeEditor
                    model={group.model}
                    onChange={(model) =>
                      commit(
                        replaceAt(slots, index, {
                          kind: "markdown",
                          groupId: slot.groupId,
                          group: { kind: "code", model },
                          elements: serialiseMarkdownGroup({ kind: "code", model }, slot.groupId),
                        }),
                      )
                    }
                  />
                ) : (
                  <MarkdownTableEditor
                    model={group.model}
                    onChange={(model) =>
                      commit(
                        replaceAt(slots, index, {
                          kind: "markdown",
                          groupId: slot.groupId,
                          group: { kind: "table", model },
                          elements: serialiseMarkdownGroup({ kind: "table", model }, slot.groupId),
                        }),
                      )
                    }
                  />
                )}
              </FlowBlock>
            </Fragment>
          );
        }
        if (slot.kind === "json") {
          return (
            <Fragment key={`json-${slot.groupId}`}>
              {insertionPoint(index)}
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
            {insertionPoint(index)}
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
        open={insertIndex === slots.length}
        onToggle={(next) => setInsertIndex(next ? slots.length : null)}
        onAdd={(element) => insertElementAt(slots.length, element)}
        onAddGroup={(group) => insertGroupAt(slots.length, group)}
      />
    </div>
  );
}

interface BlockProps extends BlockActions {
  element: ContentElement;
  onChange: (element: ContentElement) => void;
  depth: number;
}

function actionsOf(props: BlockProps): BlockActions {
  return {
    onMoveUp: props.onMoveUp,
    onMoveDown: props.onMoveDown,
    onInsertBefore: props.onInsertBefore,
    onInsertAfter: props.onInsertAfter,
    onDuplicate: props.onDuplicate,
    onDelete: props.onDelete,
    canMoveUp: props.canMoveUp,
    canMoveDown: props.canMoveDown,
  };
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

/**
 * Document-flow wrapper: blocks sit in the order they compile, with their
 * actions (move, insert before/after, duplicate, delete) behind a single
 * icon that opens on click or tap. Placeholder tokens host the icon inside
 * the token instead. Inline blocks flow alongside their neighbours until a
 * line break; full blocks take the whole row.
 */
function FlowBlock(
  props: BlockProps & {
    kind: "text" | "placeholder" | "conditional";
    display?: "inline" | "full" | "break";
    actionsInside?: boolean;
    children: ReactNode;
  },
): JSX.Element {
  const { kind, display = "full", actionsInside = false, children } = props;
  return (
    <div className={`its-flow its-flow--${kind} its-flow--${display}`}>
      <div className="its-flow__content">{children}</div>
      {!actionsInside && <BlockActionsMenu {...actionsOf(props)} />}
    </div>
  );
}

function TextBlock(props: BlockProps & { element: TextElement }): JSX.Element {
  const { element, onChange } = props;
  const layout = textLayout(element.text);

  if (layout === "break") {
    const count = element.text.length;
    return (
      <FlowBlock {...props} kind="text" display="break">
        <span
          className="its-breakchip"
          style={count > 1 ? { marginBottom: `${(count - 1) * 0.7}em` } : undefined}
          title={count === 1 ? "Line break" : `${count} line breaks (blank line in the output)`}
        >
          {"↵"}
          {count > 1 ? ` ×${count}` : ""}
        </span>
      </FlowBlock>
    );
  }

  if (layout === "inline") {
    if (isHorizontalRuleText(element.text)) {
      return (
        <FlowBlock {...props} kind="text" display="break">
          <span className="its-hrchip" title="Horizontal rule: emitted as --- in the output" />
        </FlowBlock>
      );
    }
    const heading = parseHeadingText(element.text);
    if (heading !== null) {
      return (
        <FlowBlock {...props} kind="text" display="inline">
          <span className="its-heading">
            <select
              className="its-heading__level"
              aria-label="Heading level"
              value={heading.level}
              onChange={(event) =>
                onChange({ ...element, text: serialiseHeadingText(Number(event.target.value), heading.content) })
              }
            >
              {[1, 2, 3, 4, 5, 6].map((level) => (
                <option key={level} value={level}>
                  H{level}
                </option>
              ))}
            </select>
            <span
              className={`its-grow its-grow--text its-grow--head its-grow--head-h${heading.level}`}
              data-value={heading.content || "Heading"}
            >
              <VariableField
                as="input"
                className="its-flowinline its-heading__text"
                value={heading.content}
                placeholder="Heading"
                title={'Heading text; the #-marks are emitted for you. Supports ${variables}.'}
                onValueChange={(content) => onChange({ ...element, text: serialiseHeadingText(heading.level, content) })}
              />
            </span>
          </span>
        </FlowBlock>
      );
    }
    return (
      <FlowBlock {...props} kind="text" display="inline">
        <span className="its-grow its-grow--text" data-value={element.text}>
          <VariableField
            as="input"
            className="its-flowinline"
            value={element.text}
            placeholder="text"
            title={'Static content flowing inline. Reference variables with ${name}, or right-click to insert one. Add a Line break block to end the line.'}
            onValueChange={(text) => onChange({ ...element, text })}
          />
        </span>
      </FlowBlock>
    );
  }

  return (
    <FlowBlock {...props} kind="text">
      <VariableField
        as="textarea"
        className="its-flowtext"
        rows={Math.min(12, Math.max(1, element.text.split("\n").length))}
        value={element.text}
        placeholder={'Static content. Reference variables with ${name}, or right-click to insert one.'}
        onValueChange={(text) => onChange({ ...element, text })}
      />
    </FlowBlock>
  );
}

function PlaceholderBlock(props: BlockProps & { element: PlaceholderElement }): JSX.Element {
  const { element, onChange } = props;
  const { instructionTypes } = useEditorContext();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const definition = instructionTypes[element.instructionType];
  const knownType = definition !== undefined;
  const extraConfig = Object.keys(element.config).filter(
    (key) => !["description", "displayName"].includes(key) && element.config[key] !== undefined,
  );

  return (
    <FlowBlock {...props} kind="placeholder" display="inline" actionsInside>
      <div className={knownType ? "its-token" : "its-token its-token--unknown"}>
        <span className="its-token__chevrons">&laquo;</span>
        <select
          className="its-token__type"
          aria-label="Instruction type"
          value={element.instructionType}
          onChange={(event) => onChange({ ...element, instructionType: event.target.value })}
        >
          {!knownType && <option value={element.instructionType}>{element.instructionType} (unknown)</option>}
          {Object.keys(instructionTypes).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <span className="its-grow its-grow--desc" data-value={element.config.description || "What should the AI generate here?"}>
          <VariableField
            as="input"
            className="its-token__description"
            value={element.config.description ?? ""}
            placeholder="What should the AI generate here?"
            ariaLabel="Placeholder description"
            onValueChange={(description) => onChange({ ...element, config: { ...element.config, description } })}
          />
        </span>
        <span className="its-token__chevrons">&raquo;</span>
        {extraConfig.length > 0 && (
          <span className="its-token__badge" title={extraConfig.join(", ")}>
            {extraConfig.length} option{extraConfig.length === 1 ? "" : "s"}
          </span>
        )}
        <button
          type="button"
          className="its-token__settings"
          title="Placeholder settings"
          aria-label="Open placeholder settings"
          aria-haspopup="dialog"
          onClick={() => setSettingsOpen(true)}
        >
          ⚙
        </button>
        <BlockActionsMenu {...actionsOf(props)} />
      </div>
      {settingsOpen && (
        <Modal
          title={
            <>
              Placeholder settings
              {element.config.displayName ? ` - ${element.config.displayName}` : ""}
            </>
          }
          onClose={() => setSettingsOpen(false)}
        >
          {!knownType && (
            <p className="its-block__warning">
              No definition found for "{element.instructionType}". Add it to the template's custom instruction types, or
              extend a schema that defines it.
            </p>
          )}
          <ConfigForm
            definition={definition}
            config={element.config}
            onChange={(config) => onChange({ ...element, config })}
          />
        </Modal>
      )}
    </FlowBlock>
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
    <FlowBlock {...props} kind="conditional">
      <div className="its-flowcond__head">
        <span className="its-flowcond__keyword">if</span>
        <VariableField
          as="input"
          className="its-condition"
          insertFormat="bare"
          value={element.condition}
          placeholder={"e.g. audienceLevel == 'technical' && featureCount > 3 (right-click to insert a variable)"}
          onValueChange={(condition) => onChange({ ...element, condition })}
        />
      </div>
      <div className="its-branch">
        <BlockList elements={element.content} onChange={(content) => onChange({ ...element, content })} depth={depth + 1} />
      </div>
      {hasElse && (
        <>
          <span className="its-flowcond__keyword">else</span>
          <div className="its-branch its-branch--else">
            <BlockList
              elements={element.else ?? []}
              onChange={(elseContent) => onChange({ ...element, else: elseContent })}
              depth={depth + 1}
            />
          </div>
        </>
      )}
      <button type="button" className="its-branch__toggle" onClick={toggleElse}>
        {hasElse ? "Remove else branch" : "Add else branch"}
      </button>
    </FlowBlock>
  );
}
