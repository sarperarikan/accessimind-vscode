# Changelog

All notable changes to the AccessiMind extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.2] - 2026-01-23

### Added
- **Ollama Support** - Added support for local AI models via Ollama for 100% privacy
- **Next-Gen AI Models** - Support for GPT-5.2 Codex, Gemini 2.5, and Claude 3.5 Sonnet
- **Terminology Update** - Replaced "compliance" with "conformance" to align with official WCAG terminology
- **New Repository** - Updated project links to the new repository: `https://github.com/sarperarikan/accessimind-vscode`

### Improved
- Updated internal Help & Documentation with Ollama setup guides
- Refined AI prompts for better enterprise-grade code suggestions
- Improved UI accessibility and screen reader announcements

## [1.1.0] - 2024-12-23

### Added
- **Help & Documentation Panel** - Comprehensive in-app documentation with table of contents
- **AI Providers Guide** - Detailed setup instructions for Gemini and Copilot
- **WCAG Criteria Links** - Clickable WCAG criteria with full titles and W3C documentation links
- **Modern Settings Panel** - Tabbed interface with 4 sections (General, Analysis, Jira, Shortcuts)
- **Chat Shortcuts** - Keyboard shortcut for opening chat (`Ctrl+Shift+C`)
- **Help Shortcut** - Keyboard shortcut for help (`Ctrl+Shift+H`)
- **Status Bar Menu** - Quick access to Settings and Help from status bar
- **Issue Type Selection** - Choose Bug, Story, Task, or Improvement for Jira tasks
- **Jira Summary/Description** - Structured output with Summary first
- **API Optimizations** - Connection pooling, retry logic, and prompt optimization

### Changed
- **Command Palette** - Cleaner command names with ♿ prefix and icons
- **Jira Export Button** - Moved to first position for easier access
- **Close Button Accessibility** - Enhanced with proper ARIA labels and keyboard support
- **Version bump** - Updated to 1.1.0

### Fixed
- Duplicate command prefix issue ("AccessiMind: AccessiMind:")
- TOC links in help documentation now work correctly

## [1.0.1] - 2024-12-20

### Added
- **Jira Task Webview** - Modern, accessible panel for Jira task results
- **Export Options** - JSON and Markdown export for Jira tasks
- **WCAG Tags Display** - Show identified WCAG criteria in results

### Changed
- Improved error handling for API calls
- Better Turkish language support

### Fixed
- Chat view registration issues
- Statistics panel close button functionality

## [1.0.0] - 2024-12-15

### Added
- Initial release of AccessiMind
- **AI Code Analysis** - WCAG 2.2 conformance checking
- **Multi-Provider Support** - Google Gemini and GitHub Copilot
- **AI Chat** - Interactive accessibility assistant
- **Statistics Dashboard** - Track improvements over time
- **Jira Integration** - Export findings as Jira tasks
- **Setup Wizard** - Guided configuration experience
- **Multi-language** - English and Turkish support
- **Keyboard Shortcuts** - Quick access to all features
- **Status Bar** - Real-time improvement counter

### Supported File Types
- HTML, CSS, SCSS, LESS
- JavaScript, TypeScript
- JSX, TSX (React)
- Vue, Angular, Svelte

### WCAG Coverage
- Level A (Basic)
- Level AA (Standard) - Recommended
- Level AAA (Enhanced)

---

## Roadmap

### Upcoming Features
- [ ] Batch file analysis
- [ ] Custom WCAG rule definitions
- [ ] Team collaboration features
- [ ] More language support
- [ ] Browser extension companion

---

## Links

- [GitHub Repository](https://github.com/sarperarikan/accessimind-vscode)
- [Report Issues](https://github.com/sarperarikan/accessimind-vscode/issues)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=sarperarikan.accessimind)