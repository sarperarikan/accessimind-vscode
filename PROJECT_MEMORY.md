# AccessiMind Project Memory

## Purpose
- This repository contains the `AccessiMind` VS Code extension.
- Product goal: analyze and improve code for WCAG 2.2 conformance with AI assistance.
- It also includes a browser companion extension and a live browser bridge for Chrome/Edge inspection workflows.

## Current Product Shape
- Main extension runtime is TypeScript under `src/`.
- VS Code extension entrypoint is `src/extension.ts`.
- The extension has multiple user surfaces:
  - sidebar main view
  - chat view
  - settings UI
  - statistics panels
  - command palette commands
  - editor context menu commands
  - browser preview / browser inspection flows
- Repo version in `package.json` is `1.1.5`.

## Architecture Overview

### Activation and bootstrap
- `src/extension.ts` is the main composition root.
- `src/extensionBootstrap.ts` holds settings/bootstrap helpers:
  - load saved settings
  - load settings from AccessiMind JSON
  - register JSON manager commands
  - set up configuration-to-JSON sync
- `src/extensionCommands.ts` centralizes command registration.
- `src/extensionActions.ts` centralizes core command handlers and editor actions.

### Core domains
- `src/core/wcagImprover.ts`
  - AI-driven improvement engine.
- `src/core/wcagAnalyzer.ts`
  - WCAG analysis logic.
- `src/core/selfCorrectionManager.ts`
  - self-correction / post-processing related logic.
- `src/core/statisticsTracker.ts`
  - statistics recording support.

### AI/provider layer
- Older manager path still used by runtime:
  - `src/utils/aiProvider.ts`
- Newer provider abstraction also exists:
  - `src/infrastructure/providers/`
- Important provider-related files:
  - `src/infrastructure/providers/ai-provider-manager.ts`
  - `src/infrastructure/providers/ai-provider.types.ts`
  - `src/infrastructure/providers/copilot-provider.ts`
  - `src/infrastructure/providers/gemini-provider.ts`
  - `src/infrastructure/providers/ollama-provider.ts`
- Supported provider families in manifest/config:
  - `gemini`
  - `vscode-copilot`
  - `ollama`
  - `codex-subscription`

### Settings and persistence
- `src/utils/settingsManager.ts`
  - in-extension settings management.
- `src/utils/persistentSettingsManager.ts`
  - persistent export/import/restore flows.
- `src/utils/accessiMindJsonManager.ts`
  - external JSON-backed settings/state file management.
- Settings sync path matters:
  - VS Code config
  - AccessiMind JSON file
  - persistent settings manager
- Activation order currently loads:
  - saved VS Code settings
  - JSON-backed settings
  - persistent settings restore

### UI/webview layer
- `src/views/tabbedMainViewProvider.ts`
  - main sidebar webview.
- `src/views/chatViewProvider.ts`
  - AI chat UI.
- `src/views/settingsViewProvider.ts`
  - tree/settings view.
- `src/views/modernSettingsPanel.ts`
  - modern settings panel.
- `src/views/statsViewProvider.ts`
  - stats view.
- `src/views/modernStatsViewProvider.ts`
  - richer stats view.
- `src/views/helpPanel.ts`
  - help/documentation UI.
- Browser-related panels:
  - `src/views/browserInspectorPanel.ts`
  - `src/views/browserSessionPanel.ts`
  - `src/views/embeddedBrowserInspectorPanel.ts`

### Browser integration
- New live browser integration is an important current area.
- Relevant utilities:
  - `src/utils/browserIntegrationUtils.ts`
  - `src/utils/browserSelectionServer.ts`
  - `src/utils/liveChromeBridge.ts`
- Manifest contains `wcagEnhancer.browserIntegration` configuration:
  - `enabled`
  - `browserPath`
  - `launchMode`
- `showInBrowser` exists in `src/extensionActions.ts` and creates local HTML preview files.
- Separate browser companion extension exists under:
  - `browser-extension/accessimind-companion/`
- Companion files:
  - `manifest.json`
  - `service-worker.js`
  - `content-script.js`
  - `popup.html`
  - `popup.js`

## Command / UX Notes
- Command ids still use the historical `wcagEnhancer.*` namespace.
- Branding shown to users is `AccessiMind`.
- Important user commands include:
  - analyze open file
  - analyze selection
  - preview improvement
  - chat
  - inline chat
  - settings
  - help
  - show in browser
  - statistics export/reset
  - JSON manager commands

## Current Implementation Direction
- This codebase appears mid-refactor, not greenfield-clean.
- Several responsibilities were recently split out of `src/extension.ts` into:
  - `src/extensionBootstrap.ts`
  - `src/extensionCommands.ts`
  - `src/extensionActions.ts`
- There is a coexistence phase between old utility/provider code and newer infrastructure/provider abstractions.
- Browser integration files are newly added and likely still evolving.
- A likely next major capability is `agentic` execution on top of the currently selected AI provider, especially for multi-step fix / inspect / plan workflows inside the extension UI.

## Agentic / Provider Runtime Status
- Agentic production flow is active again through:
  - `wcagEnhancer.startAgentSession`
  - `src/agent/agentSessionManager.ts`
  - `src/agent/agentSkills.ts`
  - `src/agent/agentTypes.ts`
- Current agent behavior:
  - uses the currently selected AI provider
  - collects active editor, selected text, and a bounded workspace file map
  - creates a Markdown implementation plan before any edit
  - generates code only after user confirmation
  - opens a diff and applies changes only after explicit approval
- Current built-in agent workflows:
  - fix active file
  - fix selection
  - investigate workspace
  - production plan
- Provider model selection is dynamic through:
  - `wcagEnhancer.selectProviderModel`
  - `AIProviderManager.refreshCurrentProviderModels()`
  - `AIProviderManager.selectModelForCurrentProvider()`
- Provider model discovery sources:
  - Gemini: Google Generative Language models API when an API key exists, with paginated dynamic discovery and 3.5/2.5-first fallback defaults
  - VS Code Copilot: VS Code Language Model API / installed Copilot entitlement
  - Ollama: local `/api/tags`
  - Codex Subscription: local `codex exec` through Codex CLI using ChatGPT/Codex sign-in; this is subscription-backed Codex auth, not a generic ChatGPT web-session API
- Codex subscription provider files:
  - `src/infrastructure/providers/codex-subscription-provider.ts`
  - `wcagEnhancer.ai.codexPath`
  - `wcagEnhancer.ai.codexTimeoutMs`
- Codex account commands:
  - `wcagEnhancer.connectCodexAccount`
  - `wcagEnhancer.testCodexAccount`
  - `src/utils/codexAccountAuth.ts`
- Codex account behavior:
  - `connectCodexAccount` selects `codex-subscription` and opens a terminal with `codex login`
  - `testCodexAccount` validates the saved ChatGPT/Codex account by running `codex exec` and expecting a fixed response
  - This route intentionally avoids OpenAI API keys
  - On Windows, `src/utils/codexAccountAuth.ts` resolves the native npm-installed `codex.exe` before falling back to `codex`, avoiding the WindowsApps alias `Access is denied` failure
- Local Codex CLI state observed on this machine:
  - npm package `@openai/codex` version `0.142.5`
  - native executable under `%APPDATA%\npm\node_modules\@openai\codex\node_modules\@openai\codex-win32-x64\vendor\...\bin\codex.exe`
  - `codex login status` returned `Logged in using ChatGPT`
  - `codex exec --model gpt-5.5 --sandbox read-only "Reply exactly ACCESSIMIND_CODEX_OK"` returned `ACCESSIMIND_CODEX_OK`
  - Codex provider prompts are now sent through stdin with `codex exec ... --output-last-message <tempfile> -`; the extension reads the temp file instead of raw stdout so CLI warnings/transcripts do not become the analysis result
  - Codex provider retries once with a stricter code-only contract when the final answer is invalid, and refuses to apply "."/OK/too-short non-code responses
  - Codex provider and account test now pass `--skip-git-repo-check` and fall back to the user home directory when VS Code has no workspace folder, fixing `Not inside a trusted directory` for temp/non-repo analysis contexts while keeping sandbox `read-only`
- ChatGPT handoff exists through:
  - `wcagEnhancer.openChatGptBridge`
  - `src/utils/chatGptBridge.ts`
  - `src/utils/chatGptAuth.ts`
- ChatGPT bridge behavior:
  - builds a ChatGPT prompt URL
  - copies the full prompt to clipboard
  - opens ChatGPT or a configured ChatGPT app URL in the browser on user action
  - supports `wcagEnhancer.configureChatGptAuth` and `wcagEnhancer.openChatGptAuthGuide`
  - stores only ChatGPT app / MCP server URLs under `wcagEnhancer.chatGptIntegration`
  - documents that real account-connected ChatGPT integration should use OpenAI Apps SDK / MCP OAuth authorization, not hidden browser control or cookie/session reuse

## Working Assumptions For Future Sessions
- Treat `src/extension.ts` as the authoritative runtime entrypoint.
- Prefer real source over older prose docs if they conflict.
- Expect some stale branding/history:
  - old name: `WCAG Enhancer`
  - current product name: `AccessiMind`
- Analysis settings now also include disability-focus targeting via `wcagEnhancer.analysisDisabilityFocus`, intended to bias improvements toward selected user groups while keeping baseline WCAG coverage.
- Expect some stale docs/assets:
  - `README.md` still references `accessi-mind.jpg`, but repo currently has `accessi-mind.png` and git status showed the JPG deleted.
- Be careful with encoding in old docs and strings; some files contain mojibake or legacy non-UTF8 text artifacts.

## Repository State Snapshot
- At the time this memory was created, the git worktree was dirty.
- Modified tracked files included:
  - `.vscodeignore`
  - `jest.config.js`
  - `media/chat.css`
  - `media/chat.js`
  - several files under `src/`
- Untracked additions included:
  - `browser-extension/`
  - `src/extensionActions.ts`
  - `src/extensionBootstrap.ts`
  - `src/extensionCommands.ts`
  - several browser integration files under `src/utils/` and `src/views/`
- Do not assume a clean tree when continuing work.
- Do not revert unrelated user changes.

## Files To Read First When Resuming
1. `PROJECT_MEMORY.md`
2. `package.json`
3. `src/extension.ts`
4. `src/extensionBootstrap.ts`
5. `src/extensionCommands.ts`
6. `src/extensionActions.ts`

## Resume Checklist
- Confirm current git status before editing.
- Check whether the task is in the legacy path or the new split modules.
- If the task touches providers, inspect both:
  - `src/utils/aiProvider.ts`
  - `src/infrastructure/providers/`
- If the task touches browser work, inspect both:
  - extension-side bridge files in `src/utils/` and `src/views/`
  - companion extension in `browser-extension/accessimind-companion/`
- If docs and code conflict, trust code and update docs deliberately.

## Memory Maintenance
- Update this file after meaningful architecture, workflow, or product-surface changes.
- Keep it factual and biased toward current source state, not aspirations.
