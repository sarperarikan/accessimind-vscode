# AccessiMind - AI WCAG Accessibility

<p align="center">
  <img src="accessi-mind.png" alt="AccessiMind logo" width="128">
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=sarperarikan.accessimind">
    <img src="https://img.shields.io/visual-studio-marketplace/v/sarperarikan.accessimind?color=blue&label=VS%20Code%20Marketplace" alt="VS Code Marketplace version">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=sarperarikan.accessimind">
    <img src="https://img.shields.io/visual-studio-marketplace/d/sarperarikan.accessimind?color=green" alt="Marketplace downloads">
  </a>
  <img src="https://img.shields.io/badge/WCAG-2.2-success" alt="WCAG 2.2">
  <img src="https://img.shields.io/badge/AI-Gemini%20%7C%20Copilot%20%7C%20Ollama%20%7C%20Codex-blue" alt="AI providers">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license">
</p>

AccessiMind is a VS Code extension for finding and improving accessibility issues in code. It combines WCAG 2.2 analysis, AI-assisted fixes, provider model selection, agentic planning, browser inspection workflows, Jira-ready task generation, and usage statistics.

The public command namespace is still `wcagEnhancer.*` for backward compatibility, while user-facing branding is AccessiMind.

## Current Capabilities

### WCAG 2.2 Code Analysis

- Analyze the active file or selected code from the editor context menu or Command Palette.
- Apply AI-generated accessibility improvements directly to the editor.
- Target WCAG levels A, AA, or AAA.
- Use strict mode, context-aware analysis, custom rule files, and disability-focus targeting.
- Prioritize screen reader, low vision, hearing, motor, or cognitive accessibility needs while keeping baseline WCAG coverage.

### AI Providers

AccessiMind can use several provider families:

| Provider | Use case | Requirement |
| --- | --- | --- |
| Gemini | Google Gemini API models for general WCAG analysis and fixes | Gemini API key |
| VS Code Copilot | GitHub Copilot-backed language models through the VS Code Language Model API | Active Copilot entitlement |
| Ollama | Local/private model execution | Local Ollama server |
| Codex Subscription | Codex CLI through ChatGPT/Codex sign-in | Installed Codex CLI and signed-in ChatGPT/Codex account |

Model selection is dynamic through `AccessiMind: Select Provider Model`. Gemini discovery uses the Google models API when an API key is available, Copilot discovery uses VS Code's language model API, Ollama discovery reads local `/api/tags`, and Codex Subscription runs through local `codex exec`.

### Agent Session

`AccessiMind: Agent Session` starts a guided workflow that:

- Uses the currently selected AI provider.
- Collects active editor context, selected text, and a bounded workspace file map.
- Creates a Markdown implementation plan before editing.
- Generates code only after confirmation.
- Opens a diff and applies changes only after explicit approval.

Built-in workflows include fixing the active file, fixing a selection, investigating the workspace, and creating a production plan.

### Browser And Companion Extension

AccessiMind includes live browser-oriented workflows:

- `AccessiMind: Show in Browser` creates a temporary HTML preview for the active file.
- Browser integration settings control the live Chrome/Edge inspector bridge.
- The companion browser extension lives in `browser-extension/accessimind-companion/`.
- Browser bridge utilities support selection capture and live inspection flows.

Browser integration settings:

| Setting | Purpose |
| --- | --- |
| `wcagEnhancer.browserIntegration.enabled` | Enables live browser inspection support |
| `wcagEnhancer.browserIntegration.browserPath` | Optional Chrome or Edge executable path |
| `wcagEnhancer.browserIntegration.launchMode` | Launch an isolated debugging browser or attach to an existing debugging session |

### Chat And ChatGPT Handoff

- `AccessiMind: Chat` opens the in-sidebar chat view.
- `AccessiMind: Inline Chat` edits selected code with natural-language instructions.
- `AccessiMind: Open in ChatGPT` builds an accessibility prompt, copies the full prompt to the clipboard, and opens ChatGPT or a configured ChatGPT app URL.
- `AccessiMind: Configure ChatGPT Auth` stores ChatGPT app and MCP server URLs for account-authorized handoff flows.
- The ChatGPT bridge is a handoff path. It does not reuse hidden browser sessions or cookies.

### Jira, Statistics, And Settings

- Generate Jira-ready accessibility tasks from findings.
- Export and reset statistics.
- Track improvements by time period, language, provider, model, and WCAG criteria.
- Export, import, restore, clear, and inspect persistent settings.
- Sync supported settings with the AccessiMind JSON-backed settings file.

## Commands

| Command title | Command id | Description |
| --- | --- | --- |
| AccessiMind: Analyze Open File | `wcagEnhancer.analyzeOpenCode` | Analyze and improve the active file |
| AccessiMind: Analyze Selection | `wcagEnhancer.analyzeSelectedCode` | Analyze and improve selected code |
| AccessiMind: Preview Improvement | `wcagEnhancer.previewImprovement` | Preview an AI improvement |
| AccessiMind: Chat | `wcagEnhancer.openChat` | Focus the AccessiMind chat view |
| AccessiMind: Inline Chat | `wcagEnhancer.inlineChat` | Modify selected code from an instruction |
| AccessiMind: Settings | `wcagEnhancer.openSettings` | Open the native settings UI |
| AccessiMind: Help & Documentation | `wcagEnhancer.openHelp` | Open the help panel |
| AccessiMind: Show in Browser | `wcagEnhancer.showInBrowser` | Open a browser preview for the active file |
| AccessiMind: Agent Session | `wcagEnhancer.startAgentSession` | Start guided plan, generate, diff, and apply flow |
| AccessiMind: Select Provider Model | `wcagEnhancer.selectProviderModel` | Refresh and select models for the active provider |
| AccessiMind: Connect Codex Account | `wcagEnhancer.connectCodexAccount` | Select Codex Subscription and open `codex login` |
| AccessiMind: Test Codex Account | `wcagEnhancer.testCodexAccount` | Validate the local Codex CLI account |
| AccessiMind: Open in ChatGPT | `wcagEnhancer.openChatGptBridge` | Copy prompt and open ChatGPT handoff |
| AccessiMind: Configure ChatGPT Auth | `wcagEnhancer.configureChatGptAuth` | Configure ChatGPT app and MCP URLs |
| AccessiMind: ChatGPT Auth Guide | `wcagEnhancer.openChatGptAuthGuide` | Open guidance for account-authorized ChatGPT handoff |
| AccessiMind: Create Jira Task | `wcagEnhancer.createJiraTask` | Generate a Jira-compatible accessibility task |
| AccessiMind: Statistics | `wcagEnhancer.showDetailedStatistics` | View detailed statistics |
| AccessiMind: Export Statistics | `wcagEnhancer.exportStatistics` | Export statistics |
| AccessiMind: Reset Statistics | `wcagEnhancer.resetStatistics` | Reset statistics |
| AccessiMind: User Journey Scan | `wcagEnhancer.userJourneyScan` | Run user-journey accessibility analysis |
| AccessiMind: DOM Diff Risk | `wcagEnhancer.domDiffRisk` | Analyze DOM-change accessibility risk |
| AccessiMind: Design Token Guard | `wcagEnhancer.designTokenGuard` | Check design-token accessibility risk |
| AccessiMind: Component Memory | `wcagEnhancer.componentMemory` | Analyze component accessibility patterns |
| AccessiMind: Apply Last Fix To Similar | `wcagEnhancer.applyLastFixToSimilar` | Reuse the last fix pattern on similar code |
| AccessiMind: Generate Accessibility Test | `wcagEnhancer.generateA11yTest` | Generate an accessibility-focused test |
| AccessiMind: Generate PR Summary | `wcagEnhancer.generatePrSummary` | Generate a pull-request accessibility summary |
| AccessiMind: Regression Shield | `wcagEnhancer.regressionShield` | Run accessibility regression checks |

Default keybindings:

| Keybinding | Command |
| --- | --- |
| `Ctrl+Alt+W` | Analyze open file |
| `Ctrl+Alt+Shift+W` | Analyze selection |

## Configuration

Most settings are managed through the AccessiMind settings UI. The manifest-backed settings include:

| Setting | Default | Notes |
| --- | --- | --- |
| `wcagEnhancer.ai.provider` | `gemini` | `gemini`, `vscode-copilot`, `ollama`, or `codex-subscription` |
| `wcagEnhancer.ai.apiKey` | empty | Gemini API key |
| `wcagEnhancer.ai.ollamaUrl` | `http://localhost:11434` | Local Ollama endpoint |
| `wcagEnhancer.ai.ollamaModel` | `llama3` | Selected Ollama model |
| `wcagEnhancer.ai.codexPath` | `codex` | Codex CLI path |
| `wcagEnhancer.ai.codexTimeoutMs` | `180000` | Codex execution timeout |
| `wcagEnhancer.aiModels.selectedModel` | `gemini-2.5-flash` | Active model id |
| `wcagEnhancer.wcagLevel` | `AA` | Target WCAG level |
| `wcagEnhancer.language` | `en` | `auto`, `en`, or `tr` |
| `wcagEnhancer.strictMode` | `false` | Enables stricter analysis checks |
| `wcagEnhancer.contextAwareAnalysis` | `true` | Evaluates surrounding code context |
| `wcagEnhancer.customRulesPath` | empty | Optional markdown file with local rules |
| `wcagEnhancer.analysisDisabilityFocus` | `[]` | Optional disability-focus groups |
| `wcagEnhancer.performance.promptMaxChars` | `8000` | Prompt-size control |
| `wcagEnhancer.performance.maxScanSize` | `500000` | WCAG metadata scan limit |
| `wcagEnhancer.chatGptIntegration.enabled` | `false` | Enables ChatGPT handoff settings |

## Requirements

- VS Code 1.93.0 or newer.
- Node.js/npm for local development.
- Gemini provider: Google Gemini API key.
- VS Code Copilot provider: active GitHub Copilot access.
- Ollama provider: local Ollama server.
- Codex Subscription provider: Codex CLI installed and signed in with a ChatGPT/Codex account.
- Browser bridge features: Chrome or Edge, with optional remote debugging for attach mode.

## Development

Install dependencies:

```bash
npm install
```

Compile TypeScript:

```bash
npm run compile
```

Run unit tests:

```bash
npm run test:unit
```

Build the extension bundle:

```bash
npm run build
```

Package a VSIX:

```bash
npm run package
```

Main source areas:

| Path | Purpose |
| --- | --- |
| `src/extension.ts` | Extension composition root |
| `src/extensionActions.ts` | Core command handlers and editor actions |
| `src/extensionCommands.ts` | Command registration |
| `src/extensionBootstrap.ts` | Settings/bootstrap helpers |
| `src/core/` | WCAG analysis and improvement logic |
| `src/infrastructure/providers/` | AI provider implementations |
| `src/agent/` | Agent session planning and apply workflow |
| `src/innovation/` | Advanced accessibility workflows |
| `src/views/` | VS Code webview and settings UI surfaces |
| `src/utils/` | Browser bridge, settings, runtime, and provider utilities |
| `browser-extension/accessimind-companion/` | Browser companion extension |

## Language Support

- English UI and AI responses.
- Turkish UI and AI responses.
- `auto` language mode follows the VS Code environment where supported.

## Repository

- GitHub: [sarperarikan/accessimind-vscode](https://github.com/sarperarikan/accessimind-vscode)
- Issues: [github.com/sarperarikan/accessimind-vscode/issues](https://github.com/sarperarikan/accessimind-vscode/issues)
- WCAG 2.2 quick reference: [w3.org/WAI/WCAG22/quickref](https://www.w3.org/WAI/WCAG22/quickref/)

## License

MIT License. See [LICENSE](LICENSE) for details.

## Author

Sarper Arikan  
GitHub: [@sarperarikan](https://github.com/sarperarikan)  
Email: sarperarikan@gmail.com
