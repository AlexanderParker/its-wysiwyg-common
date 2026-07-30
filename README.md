# its-template-editor

A WYSIWYG React component for building [Instruction Template Specification (ITS)](https://alexanderparker.github.io/instruction-template-specification/) templates. The editor is fully decoupled from any compiler implementation: it edits plain template objects and has no runtime dependencies beyond React.

## Installation

```bash
npm install its-template-editor
```

React 18 or later is a peer dependency.

## Usage

```tsx
import { useState } from "react";
import { TemplateEditor, type ItsTemplate } from "its-template-editor";
import "its-template-editor/styles.css";

const initial: ItsTemplate = {
  version: "1.0.0",
  content: [{ type: "text", text: "Hello ${name}" }],
  variables: { name: "world" },
};

export function MyApp() {
  const [template, setTemplate] = useState(initial);
  return <TemplateEditor value={template} onChange={setTemplate} instructionTypes={myTypes} />;
}
```

## Props

| Prop               | Type                                          | Description                                                                                     |
| ------------------ | --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `value`            | `ItsTemplate`                                 | The template being edited. The component is fully controlled.                                   |
| `onChange`         | `(template: ItsTemplate) => void`             | Called with a new template object on every edit.                                                |
| `instructionTypes` | `Record<string, InstructionTypeDefinition>`   | Types shown in the placeholder palette, e.g. the ITS standard types. Template-level `customInstructionTypes` are merged on top automatically. |
| `showJsonTab`      | `boolean`                                     | Show the built-in JSON source tab (default `true`).                                             |
| `className`        | `string`                                      | Extra class on the editor root.                                                                 |

## Features

- Block-based editing of text, placeholder and conditional elements, including nested conditionals with else branches
- Interactive JSON structure builder: add a JSON object or array block, then add properties and items through the UI, each a fixed value, a generated fill (string, number or any value) or a nested object or array, to any depth; arrays and objects also take generated-run entries (`json_array_items`, `json_object_fields`). The structure serialises to ordinary ITS text and placeholder elements, so templates stay spec-compliant, and a template containing only a JSON structure compiles to a prompt whose one-shot response is the completed raw JSON document and nothing else
- Config forms generated from each instruction type's `configSchema` (enums, integers, booleans, strings), plus a data sources field writing the reserved `dataSource` config key: referenced variables are rendered by compilers as a REFERENCE DATA section above the template, context the model uses but never outputs (requires its-compiler-js 1.3.0 or its-compiler 1.2.0)
- Variables panel with JSON-aware value parsing and unused-variable hints
- Custom instruction types panel: define template strings and config schemas (enums, defaults, integers, booleans) directly in the studio; new types appear in the placeholder palette immediately and renames update every placeholder that references them
- Metadata panel covering name, description, author, version and `extends` schema references
- Two-way JSON source view with validation before applying
- Themeable through CSS custom properties (see the `--its-*` variables in `styles.css`); all selectors are scoped under `.its-editor`

## Design notes

The component never fetches schemas, never compiles and never touches the network. Supplying instruction type definitions (for example by fetching the ITS standard types schema) is the host application's responsibility, which keeps the editor usable in offline and server-rendered contexts.

## Development

```bash
npm install
npm run typecheck   # strict TypeScript checks
npm run build       # ESM, CJS, type declarations and stylesheet to dist/
```

A small Vite playground lets you develop the editor in isolation (it aliases the package to `src/`, so changes hot-reload):

```bash
npm install --prefix playground
npm run dev --prefix playground
```

The playground is a dev-only application; the published package ships only `dist/` and this README.

### Developing against a host application

To work on the editor and a consuming application (such as [its-template-studio](https://github.com/AlexanderParker/its-template-studio)) at the same time, link the package:

```bash
# in this repository
npm link

# in the consuming application
npm link its-template-editor
```

Run `npm run build` here after each change (or use `tsup --watch`) so the host picks up fresh output. Unlink with `npm unlink its-template-editor` in the host when done.

## Releasing

Releases publish from CI with npm provenance when a version tag is pushed:

```bash
npm version minor        # or patch / major; updates package.json and tags
git push --follow-tags
```

The release workflow needs an `NPM_TOKEN` repository secret (an npm automation token) or npm trusted publishing configured for this repository.

## ITS ecosystem

- [Specification](https://alexanderparker.github.io/instruction-template-specification/) - the ITS spec, schemas and documentation ([source](https://github.com/AlexanderParker/instruction-template-specification))
- [Template studio demo](https://alexanderparker.github.io/its-template-studio/) - build and compile templates in the browser ([source](https://github.com/AlexanderParker/its-template-studio))
- [its-compiler-js](https://github.com/AlexanderParker/its-compiler-js) - JavaScript/TypeScript reference compiler ([npm](https://www.npmjs.com/package/its-compiler-js))
- [its-compiler-python](https://github.com/AlexanderParker/its-compiler-python) - Python reference compiler library ([PyPI](https://pypi.org/project/its-compiler/))
- [its-compiler-cli](https://github.com/AlexanderParker/its-compiler-cli-python) - command-line interface for the Python compiler ([PyPI](https://pypi.org/project/its-compiler-cli/))
- [its-example-templates](https://github.com/AlexanderParker/its-example-templates) - example and test templates exercising the published schemas
