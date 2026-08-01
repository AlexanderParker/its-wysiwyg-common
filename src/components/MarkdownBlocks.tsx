import { useEditorContext } from "../context";
import type { MarkdownCodeModel, MarkdownTableModel } from "../markdownStructure";
import { replaceAt, removeAt } from "../utils";
import { VariableField } from "./VariableField";

/**
 * Structured editors for Markdown code blocks and tables. Both serialise to
 * literal Markdown text (plus an optional generated fill), so what is built
 * here appears verbatim in the compiled template.
 */

export function MarkdownCodeEditor({
  model,
  onChange,
}: {
  model: MarkdownCodeModel;
  onChange: (model: MarkdownCodeModel) => void;
}): JSX.Element {
  const { instructionTypes } = useEditorContext();
  const generatedAvailable = "markdown_code" in instructionTypes;

  return (
    <div className="its-mdblock its-mdblock--code">
      <div className="its-mdblock__head">
        <span className="its-mdblock__label">Code block</span>
        <input
          type="text"
          className="its-mdblock__lang its-mono"
          placeholder="language"
          spellCheck={false}
          aria-label="Code block language"
          value={model.language}
          onChange={(event) => onChange({ ...model, language: event.target.value.trim() })}
        />
        {generatedAvailable && (
          <select
            className="its-mdblock__mode"
            aria-label="Code body kind"
            value={model.body.kind}
            onChange={(event) =>
              onChange({
                ...model,
                body:
                  event.target.value === "generated"
                    ? { kind: "generated", description: model.body.kind === "fixed" ? "" : model.body.description }
                    : { kind: "fixed", code: "" },
              })
            }
          >
            <option value="generated">Generated</option>
            <option value="fixed">Fixed</option>
          </select>
        )}
      </div>
      {model.body.kind === "generated" ? (
        <div className="its-mdblock__genrow">
          <span className="its-json__genlabel">generated code</span>
          <VariableField
            as="input"
            className="its-json__description"
            value={model.body.description}
            placeholder="What code should be generated here?"
            onValueChange={(description) =>
              onChange({ ...model, body: { ...model.body, kind: "generated", description } })
            }
          />
        </div>
      ) : (
        <VariableField
          as="textarea"
          className="its-mdblock__code"
          rows={Math.min(12, Math.max(2, model.body.code.split("\n").length))}
          spellCheck={false}
          value={model.body.code}
          placeholder="Type the code emitted verbatim inside the fences"
          onValueChange={(code) => onChange({ ...model, body: { kind: "fixed", code } })}
        />
      )}
    </div>
  );
}

export function MarkdownTableEditor({
  model,
  onChange,
}: {
  model: MarkdownTableModel;
  onChange: (model: MarkdownTableModel) => void;
}): JSX.Element {
  const { instructionTypes } = useEditorContext();
  const generatedAvailable = "markdown_table_rows" in instructionTypes;

  const setColumn = (index: number, name: string): void =>
    onChange({ ...model, columns: replaceAt(model.columns, index, name) });

  const removeColumn = (index: number): void => {
    if (model.columns.length <= 1) return;
    const columns = removeAt(model.columns, index);
    const body =
      model.body.kind === "rows"
        ? { kind: "rows" as const, rows: model.body.rows.map((row) => removeAt(row, index)) }
        : model.body;
    onChange({ columns, body });
  };

  const addColumn = (): void => {
    const columns = [...model.columns, `Column ${model.columns.length + 1}`];
    const body =
      model.body.kind === "rows"
        ? { kind: "rows" as const, rows: model.body.rows.map((row) => [...row, ""]) }
        : model.body;
    onChange({ columns, body });
  };

  return (
    <div className="its-mdblock its-mdblock--table">
      <div className="its-mdblock__head">
        <span className="its-mdblock__label">Table</span>
        {generatedAvailable && (
          <select
            className="its-mdblock__mode"
            aria-label="Table body kind"
            value={model.body.kind === "generated" ? "generated" : "rows"}
            onChange={(event) =>
              onChange({
                ...model,
                body:
                  event.target.value === "generated"
                    ? { kind: "generated", description: "" }
                    : { kind: "rows", rows: [model.columns.map(() => "")] },
              })
            }
          >
            <option value="generated">Generated rows</option>
            <option value="rows">Fixed rows</option>
          </select>
        )}
      </div>
      <div className="its-mdtable__grid" style={{ gridTemplateColumns: `repeat(${model.columns.length}, minmax(6rem, 1fr)) 2rem` }}>
        {model.columns.map((name, index) => (
          <span className="its-mdtable__headcell" key={`h-${index}`}>
            <VariableField
              as="input"
              className="its-mdtable__colname"
              value={name}
              ariaLabel={`Column ${index + 1} header`}
              onValueChange={(next) => setColumn(index, next)}
            />
            <button
              type="button"
              className="its-json__remove"
              title="Remove column"
              aria-label={`Remove column ${index + 1}`}
              disabled={model.columns.length <= 1}
              onClick={() => removeColumn(index)}
            >
              ✕
            </button>
          </span>
        ))}
        <button type="button" className="its-mdtable__addcol" title="Add column" aria-label="Add column" onClick={addColumn}>
          +
        </button>
        {model.body.kind === "rows" &&
          model.body.rows.map((row, rowIndex) => (
            <RowCells
              key={`r-${rowIndex}`}
              row={row}
              rowIndex={rowIndex}
              onCell={(cellIndex, next) => {
                if (model.body.kind !== "rows") return;
                onChange({
                  ...model,
                  body: { kind: "rows", rows: replaceAt(model.body.rows, rowIndex, replaceAt(row, cellIndex, next)) },
                });
              }}
              onRemove={() => {
                if (model.body.kind !== "rows") return;
                onChange({ ...model, body: { kind: "rows", rows: removeAt(model.body.rows, rowIndex) } });
              }}
            />
          ))}
      </div>
      {model.body.kind === "rows" ? (
        <button
          type="button"
          className="its-branch__toggle"
          onClick={() =>
            model.body.kind === "rows" &&
            onChange({ ...model, body: { kind: "rows", rows: [...model.body.rows, model.columns.map(() => "")] } })
          }
        >
          + Add row
        </button>
      ) : (
        <div className="its-mdblock__genrow">
          <span className="its-json__genlabel">generated rows</span>
          <VariableField
            as="input"
            className="its-json__description"
            value={model.body.description}
            placeholder="What rows should be generated here?"
            onValueChange={(description) =>
              model.body.kind === "generated" &&
              onChange({ ...model, body: { ...model.body, description } })
            }
          />
          <input
            className="its-json__count"
            type="number"
            min={1}
            value={model.body.rowCount ?? ""}
            placeholder="rows"
            aria-label="Number of generated rows"
            onChange={(event) => {
              if (model.body.kind !== "generated") return;
              const parsed = parseInt(event.target.value, 10);
              const body = { ...model.body };
              if (Number.isNaN(parsed) || parsed < 1) {
                delete body.rowCount;
              } else {
                body.rowCount = parsed;
              }
              onChange({ ...model, body });
            }}
          />
        </div>
      )}
    </div>
  );
}

function RowCells({
  row,
  rowIndex,
  onCell,
  onRemove,
}: {
  row: string[];
  rowIndex: number;
  onCell: (cellIndex: number, value: string) => void;
  onRemove: () => void;
}): JSX.Element {
  return (
    <>
      {row.map((cell, cellIndex) => (
        <VariableField
          key={`c-${rowIndex}-${cellIndex}`}
          as="input"
          className="its-mdtable__cell"
          value={cell}
          ariaLabel={`Row ${rowIndex + 1} cell ${cellIndex + 1}`}
          onValueChange={(next) => onCell(cellIndex, next)}
        />
      ))}
      <button
        type="button"
        className="its-json__remove"
        title="Remove row"
        aria-label={`Remove row ${rowIndex + 1}`}
        onClick={onRemove}
      >
        ✕
      </button>
    </>
  );
}
