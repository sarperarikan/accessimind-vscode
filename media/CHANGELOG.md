# Change Log

All notable changes to the "AccessiMind" extension will be documented in this file.

## [1.0.0] - 2025-01-07

### Added
- Initial release of AccessiMind extension
- Setup wizard with persistent settings configuration
- AI-powered accessibility analysis for code
- Interactive chat interface for accessibility questions
- Real-time file and selection improvement features
- Statistics tracking and dashboard
- Multi-language support (English, Turkish)
- WCAG Level A, AA, and AAA compliance checking
- Keyboard navigation and screen reader support
- Context menu integration for quick access
- Command palette integration
- Persistent settings storage using localStorage
- API key management and testing
- Enhancement mode selection (Conservative, Standard, Aggressive)
- Auto-save functionality
- Progress tracking with language and type breakdowns

### Features
- **Chat Interface**: Ask questions about accessibility and get AI-powered responses
- **File Enhancement**: Analyze and improve entire files for WCAG compliance
- **Selection Enhancement**: Focus on specific code selections for targeted improvements
- **Setup Wizard**: Easy onboarding with guided configuration
- **Statistics Dashboard**: Track your accessibility improvements over time
- **Settings Management**: Persistent configuration across VS Code sessions
- **Multi-language Support**: Available in English and Turkish
- **WCAG Compliance**: Support for all three WCAG levels (A, AA, AAA)

### Technical Details
- Built with VS Code Extension API
- Webview-based user interface
- LocalStorage for persistent settings
- Message passing between extension and webview
- Responsive design with VS Code theme integration
- Accessibility-first design principles

### Supported File Types
- HTML/HTML5
- CSS/SCSS/SASS
- JavaScript/TypeScript
- React/JSX
- Vue.js templates
- Angular components
- And other web technologies

### Commands
- `wcag-enhancer.openPanel` - Open AccessiMind panel
- `wcag-enhancer.runWizard` - Run setup wizard
- `wcag-enhancer.improveFile` - Improve current file
- `wcag-enhancer.improveSelection` - Improve selected code

### Configuration Options
- `wcagEnhancer.apiKey` - API key for AI service
- `wcagEnhancer.language` - Default language preference
- `wcagEnhancer.accessibilityLevel` - WCAG compliance level
- `wcagEnhancer.enhancementMode` - Enhancement aggressiveness
- `wcagEnhancer.autoSave` - Auto-save improvements

---

## Planned Features

### [1.1.0] - Future Release
- Integration with external accessibility testing tools
- Custom rule configuration
- Batch processing for multiple files
- Export accessibility reports
- Integration with CI/CD pipelines

### [1.2.0] - Future Release
- Real-time accessibility preview
- Color contrast analyzer
- Screen reader simulation
- Additional language support
- Advanced ARIA pattern suggestions

---

For more information about upcoming features and changes, visit our [GitHub repository](https://github.com/wcag-enhancer/vscode-extension).