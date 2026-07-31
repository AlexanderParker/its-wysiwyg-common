# its-template-editor

A WYSIWYG React component for building [Instruction Template Specification (ITS)](https://alexanderparker.github.io/instruction-template-specification/) templates. The editor is fully decoupled from any compiler implementation: it edits plain template objects and has no runtime dependencies beyond React.

## Installation

```bash
npm install its-template-editor
```

React 18 or later is a peer dependency.

The npm package is not yet published (the release is pending an `NPM_TOKEN` repository secret and a v0.8.1 tag). Until then, use the npm link flow documented below or a git dependency.

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
| `instructionTypes` | `Record<string, InstructionTypeDefinition>`   | Optional (defaults to `{}`). Types shown in the placeholder palette, e.g. the ITS standard types. Template-level `customInstructionTypes` are merged on top automatically. |
| `showJsonTab`      | `boolean`                                     | Show the built-in JSON source tab, labelled "JSON" (default `true`).                            |
| `className`        | `string`                                      | Extra class on the editor root.                                                                 |

## Features

- Document-flow Content tab: text, placeholder and conditional elements (including nested conditionals with else branches) lay out in document flow mirroring the compiled template - flowing monospace text, inline placeholder tokens matching the `<<...>>` markers with per-placeholder settings in a modal (gear icon), and if/else conditional rails; block actions are hover-revealed and always visible on touch devices
- Interactive JSON structure builder: add a JSON object or array block, then add properties and items through the UI, each a fixed value, a generated fill (string, number or any value) or a nested object or array, to any depth; arrays and objects also take generated-run entries (`json_array_items`, `json_object_fields`). The structure serialises to ordinary ITS text and placeholder elements, so templates stay spec-compliant, and a template containing only a JSON structure compiles to a prompt whose one-shot response is the completed raw JSON document and nothing else. The add menu offers the JSON structure option only when the palette provides the five JSON builder types (`JSON_STRUCTURE_TYPES`, exported from `jsonStructure.ts`)
- Config forms generated from each instruction type's `configSchema` (enums, integers, booleans, strings), plus data sources and data limit fields writing the reserved `dataSource` and `dataLimit` config keys: referenced variables are rendered by compilers as a REFERENCE DATA section above the template (context the model uses but never outputs), capped at the limit with the most generous request winning across placeholders; object-valued `${refs}` are also promoted to the reference data section (requires its-compiler-js 1.3.0 or its-compiler 1.2.0)
- Variables panel with JSON-aware value parsing and unused-variable hints
- Right-click variable insertion: text blocks, descriptions, config values and JSON builder fields offer an expandable tree of the template's variables - object properties, array indices (the first 10 per array), `.length` and collection function submenus (`concat`/`sum`/`avg`/`min`/`max` by property, `top` with count choices of 1, 3, 5 or 10, requiring compilers with collection function support), expanding up to four levels deep - inserting `${path}` at the caret; condition fields insert the bare path and omit functions to match expression syntax; numeric config fields use an integer-filtered mode offering only integer-producing paths and functions
- Typed fixed values in the JSON builder: fixed strings are typed without quotes, fixed numbers use a numeric input, fixed booleans a true/false select and fixed null is a single choice, so JSON syntax knowledge is never required
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
npm test            # vitest suites
npm run build       # ESM, CJS, type declarations and stylesheet to dist/
```

CI runs the same steps in order (typecheck, test, build) and then typechecks the playground (`npm run typecheck --prefix playground`).

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
- [its-compiler-dotnet](https://github.com/AlexanderParker/its-compiler-dotnet) - .NET compiler with an Azure Functions sample ([NuGet](https://www.nuget.org/packages/Its.Compiler))
- [its-compiler-cli](https://github.com/AlexanderParker/its-compiler-cli-python) - command-line interface for the Python compiler ([PyPI](https://pypi.org/project/its-compiler-cli/))
- [its-example-templates](https://github.com/AlexanderParker/its-example-templates) - example and test templates exercising the published schemas
