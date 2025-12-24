# AccessiMind

AI-powered accessibility enhancement tool for Visual Studio Code that helps developers implement WCAG guidelines and improve code accessibility.

## Features

- **AI-Powered Analysis**: Intelligent analysis of your code for accessibility improvements
- **WCAG Compliance**: Supports WCAG 2.1 Level A, AA, and AAA guidelines
- **Interactive Chat**: Chat interface for asking accessibility questions
- **Setup Wizard**: Easy configuration with persistent settings
- **Real-time Enhancement**: Improve entire files or selected code portions
- **Statistics Tracking**: Monitor your accessibility improvements over time
- **Multi-language Support**: Available in English and Turkish

## Installation

1. Install the extension from the Visual Studio Code Marketplace
2. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Run `AccessiMind: Run Setup Wizard` to configure your preferences
4. Set your API key in the settings panel

## Quick Start

### Setup Wizard
1. Open Command Palette (`Ctrl+Shift+P`)
2. Type `AccessiMind: Run Setup Wizard`
3. Follow the setup steps:
   - Choose your language preference
   - Select WCAG compliance level (A, AA, AAA)
   - Pick enhancement mode (Conservative, Standard, Aggressive)
   - Configure auto-save preferences

### Using the Extension

#### Open AccessiMind Panel
- Command Palette: `AccessiMind: Open AccessiMind`
- The panel will open beside your current editor

#### Improve Your Code
- **Entire File**: Command Palette → `AccessiMind: Improve Current File`
- **Selected Code**: Select text → Command Palette → `AccessiMind: Improve Selection`
- **Quick Actions**: Use buttons in the AccessiMind panel

#### Chat Interface
- Ask accessibility questions in the chat panel
- Get real-time suggestions and explanations
- Learn about WCAG guidelines and best practices

## Commands

- `AccessiMind: Open AccessiMind` - Open the main panel
- `AccessiMind: Run Setup Wizard` - Configure extension settings
- `AccessiMind: Improve Current File` - Analyze and improve entire file
- `AccessiMind: Improve Selection` - Analyze and improve selected code

## Settings

The extension provides the following configuration options:

- `wcagEnhancer.apiKey`: API key for AI enhancement service
- `wcagEnhancer.language`: Default language (en/tr)
- `wcagEnhancer.accessibilityLevel`: WCAG compliance level (A/AA/AAA)
- `wcagEnhancer.enhancementMode`: Enhancement aggressiveness (conservative/standard/aggressive)
- `wcagEnhancer.autoSave`: Automatically save improvements

## Supported Technologies

- HTML/HTML5
- CSS/SCSS/SASS
- JavaScript/TypeScript
- React/JSX
- Vue.js
- Angular
- And more web technologies

## WCAG Guidelines Covered

### Level A
- Images have alternative text
- Form controls have labels
- Page has proper heading structure
- Links have descriptive text

### Level AA
- Color contrast meets 4.5:1 ratio
- Text can be resized to 200%
- Keyboard navigation support
- Focus indicators are visible

### Level AAA
- Color contrast meets 7:1 ratio
- Audio/video has sign language interpretation
- Enhanced error identification
- Context-sensitive help

## Features Overview

### 🎯 Smart Analysis
- AI-powered code analysis for accessibility issues
- Context-aware suggestions based on your code
- Real-time feedback and recommendations

### 🛠️ Enhancement Tools
- File-level accessibility improvements
- Selection-based enhancements
- Automatic ARIA attribute suggestions
- Semantic HTML recommendations

### 📊 Progress Tracking
- Statistics dashboard
- Language-specific metrics
- Enhancement type breakdown
- Success rate monitoring

### ⚙️ Persistent Configuration
- Wizard-based setup
- Settings sync across sessions
- Customizable enhancement levels
- Multi-language support

## Privacy & Security

- All settings are stored locally in VS Code
- API communications are encrypted
- No personal data is collected
- Code analysis happens in real-time

## Support

- [GitHub Issues](https://github.com/wcag-enhancer/vscode-extension/issues)
- [Documentation](https://github.com/wcag-enhancer/vscode-extension/wiki)
- [Feature Requests](https://github.com/wcag-enhancer/vscode-extension/discussions)

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

This extension is licensed under the [MIT License](LICENSE).

## Changelog

### 1.0.0
- Initial release
- Setup wizard with persistent settings
- AI-powered accessibility analysis
- Interactive chat interface
- Statistics tracking
- Multi-language support (English, Turkish)
- WCAG Level A, AA, AAA compliance

---

**Enjoy making your code more accessible with AccessiMind!** 🚀