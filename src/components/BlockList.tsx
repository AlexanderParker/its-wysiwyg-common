import { Fragment } from "react";
import { useEditorContext } from "../context";
import type { ConditionalElement, ContentElement, PlaceholderElement, TextElement } from "../types";
import { insertAt, moveItem, nextElementId, removeAt, replaceAt } from "../utils";
import { AddBlockMenu } from "./AddBlockMenu";
import { BlockFrame } from "./BlockFrame";
import { ConfigForm } from "./ConfigForm";

interface BlockListProps {
  elements: ContentElement[];
  onChange: (elements: ContentElement[]) => void;
  depth?: number;
}

export function BlockList({ elements, onChange, depth = 0 }: BlockListProps): JSX.Element {
  const update = (index: number, element: ContentElement): void => onChange(replaceAt(elements, index, element));

  const duplicate = (index: number): void => {
    const source = elements[index];
    const copy = JSON.parse(JSON.stringify(source)) as ContentElement;
    copy.id = nextElementId(copy.type);
    onChange(insertAt(elements, index + 1, copy));
  };

  return (
    <div className={depth === 0 ? "its-blocklist" : "its-blocklist its-blocklist--nested"}>
      {elements.length === 0 && (
        <p className="its-blocklist__empty">
          {depth === 0
            ? "This template is empty. Add a text block to write static content, or a placeholder to insert an AI instruction."
            : "This branch is empty."}
        </p>
      )}
      {elements.map((element, index) => (
        <Fragment key={element.id ?? `${element.type}-${index}`}>
          <Block
            element={element}
            onChange={(updated) => update(index, updated)}
            onMoveUp={() => onChange(moveItem(elements, index, index - 1))}
            onMoveDown={() => onChange(moveItem(elements, index, index + 1))}
            onDuplicate={() => duplicate(index)}
            onDelete={() => onChange(removeAt(elements, index))}
            canMoveUp={index > 0}
            canMoveDown={index < elements.length - 1}
            depth={depth}
          />
        </Fragment>
      ))}
      <AddBlockMenu compact={depth > 0} onAdd={(element) => onChange([...elements, element])} />
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
