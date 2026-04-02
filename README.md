# Debug Var Exporter

> Export all variables from your VS Code debug session — including nested arrays and objects — to clipboard or JSON file with a single shortcut.

The VS Code Variables panel is great for browsing, but terrible for sharing or logging. You can't copy a whole scope, arrays don't serialize properly, and there's no way to export everything at once. This extension fixes that.

## Features

- **Export to Clipboard** — one shortcut, all variables as formatted JSON
- **Export to File** — saves a timestamped `.json` and offers to open it immediately
- **Scope filtering** — choose which scopes to include before exporting (useful to skip noisy system-level scopes)
- Recursively expands nested arrays and objects of any depth
- Parses raw debug values into proper JSON types (`true`/`false`, numbers, null)
- Includes metadata: timestamp, thread, frame name, source file, and line number

## Usage

Pause execution at a breakpoint, then:

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+Alt+C` | Export to Clipboard |
| `Ctrl+Shift+Alt+F` | Export to File |

Or open the Command Palette (`Ctrl+Shift+P`) and search for **Debug: Export Variables**.

## Example Output

```json
{
  "_meta": {
    "timestamp": "2026-04-01T13:06:19.561Z",
    "thread": "Thread 1",
    "frame": "processRequest",
    "source": "/src/api/handler.ts",
    "line": 142
  },
  "Local": {
    "method": "GET",
    "endpoint": "/api/users/42",
    "headers": [
      "Content-Type: application/json",
      "Authorization: Bearer eyJ..."
    ],
    "response": "{\"error\": \"not found\"}",
    "statusCode": 404,
    "retried": false
  }
}
```

## Compatibility

Works with any language and runtime that implements the [Debug Adapter Protocol (DAP)](https://microsoft.github.io/debug-adapter-protocol/) — which is the standard used by virtually all VS Code debuggers:

| Language | Extension |
|----------|-----------|
| JavaScript / TypeScript | Built-in |
| Python | Pylance / Debugpy |
| PHP | Xdebug / PHP Debug |
| Go | Go (Google) |
| Java / Kotlin | Extension Pack for Java |
| C / C++ | C/C++ (Microsoft) |
| C# / .NET | C# Dev Kit |
| Ruby | Ruby LSP |
| Rust | CodeLLDB |
| ADVPL / TLPP | TOTVS Developer Studio |
| ...and more | Any DAP-compliant adapter |

## Installation

### From the Marketplace
Search for **Debug Var Exporter** in the VS Code Extensions panel.

### From VSIX
1. Download the latest `.vsix` from [Releases](../../releases)
2. Open VS Code → `Ctrl+Shift+P` → `Extensions: Install from VSIX...`
3. Select the downloaded file

## Contributing

Issues and PRs are welcome. The codebase is small — the core logic lives in `src/extension.ts`.

```
src/
└── extension.ts   # All logic: DAP queries, serialization, commands
```

## License

MIT
