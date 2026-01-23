# AccessiMind - AI-Powered WCAG Enhancer

**Advanced WCAG 2.2 accessibility improvements with VS Code Copilot & Gemini AI integration**

AccessiMind is a powerful VS Code extension that helps developers create more accessible web applications by leveraging AI-powered analysis and improvements. The extension supports both Google Gemini and VS Code Copilot integration for comprehensive accessibility enhancements.

## 🌟 Features

### 🤖 AI-Powered Analysis
- **Multi-AI Support**: Integrated with Google Gemini 2.5, VS Code Copilot (GPT-5.2), and Ollama (Local AI)
- **WCAG 2.2 Conformance**: Comprehensive analysis targeting A, AA, and AAA levels
- **Smart Detection**: Automatic issue detection in HTML, CSS, JavaScript, TypeScript, and more

### ♿ Accessibility First
- **Real-time Detection**: Auto-detect WCAG issues as you code
- **Configurable Detail Levels**: Basic, Detailed, or Comprehensive analysis
- **Screen Reader Support**: Full ARIA conformance and screen reader optimization
- **Keyboard Navigation**: Complete keyboard accessibility

### 🛠️ Advanced Capabilities
- **End-to-End Improvements**: Complete code enhancement workflows
- **Auto-Fix**: Automatically fix common accessibility issues
- **Code Suggestions**: AI-generated improvement recommendations
- **Progress Tracking**: Monitor your accessibility improvements

### 🌐 Multilingual Support
- **English & Turkish**: Full interface translation support
- **Dynamic Language Switching**: Change language on-the-fly

## 🚀 Quick Start

1. **Install the Extension**
   ```bash
   code --install-extension wcag-enhancer-0.4.0.vsix
   ```

2. **Open the Setup Wizard**
   - Press `Ctrl+Shift+P`
   - Type "WCAG: Show Setup Wizard"
   - Configure your AI provider and preferences

3. **Start Analyzing**
   - Use `Ctrl+Shift+A` to analyze current code
   - Use `Ctrl+Shift+I` to improve current code
   - Use `Ctrl+Shift+D` to auto-detect issues

## 🎯 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+A` | Analyze Current Code |
| `Ctrl+Shift+I` | Improve Current Code |
| `Ctrl+Shift+D` | Auto-Detect WCAG Issues |

## 🔧 Configuration

### AI Providers

#### Google Gemini (Recommended)
1. Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Select "Google Gemini 2.0 Flash" in the setup wizard
3. Enter your API key

#### VS Code Copilot
1. Install the [GitHub Copilot extension](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot)
2. Select "VS Code Copilot Integration" in the setup wizard
3. No API key required

### Accessibility Settings

- **WCAG Level**: Choose between A, AA (recommended), or AAA
- **Detail Level**: 
  - Basic: Essential issues only
  - Detailed: Comprehensive analysis with explanations
  - Comprehensive: In-depth analysis with code examples
- **Auto-Detection**: Enable/disable automatic issue detection
- **Voice Announcements**: Screen reader support
- **Keyboard Shortcuts**: Enable accessibility shortcuts

## 📋 Supported File Types

- HTML (.html, .htm)
- CSS (.css)
- JavaScript (.js)
- TypeScript (.ts)
- React (.jsx, .tsx)
- Vue (.vue)
- Svelte (.svelte)

## 🔍 What It Detects

### WCAG 1.1.1 - Non-text Content
- Missing alt attributes on images
- Empty alt text where descriptive text is needed
- Decorative images without proper markup

### WCAG 2.4.4 - Link Purpose
- Links without descriptive text
- Generic link text like "click here"
- Missing link context

### WCAG 4.1.2 - Name, Role, Value
- Form inputs without labels
- Missing ARIA attributes
- Insufficient programmatic information

### WCAG 1.4.3 - Contrast (Minimum)
- Insufficient color contrast ratios
- Text readability issues
- Color-only information conveyance

### And Many More...
- Keyboard navigation issues
- Focus management problems
- Semantic HTML structure
- ARIA best practices

## 🛠️ Development

### Prerequisites
- Node.js 16+
- VS Code 1.74.0+
- TypeScript 4.9+

### Setup
```bash
# Clone the repository
git clone https://github.com/sarperarikan/accessimind-vscode.git

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Package the extension
npm run package
```

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📊 Usage Statistics

The extension tracks anonymized usage statistics to help improve the experience:
- Number of analyses performed
- Number of improvements applied
- Most common issues detected
- Performance metrics

All data is stored locally and never transmitted externally.

## 🆘 Support

### Common Issues

**Extension not activating?**
- Ensure VS Code version 1.74.0 or higher
- Check the Output panel for error messages

**AI provider not working?**
- Verify your API key is correct
- Check your internet connection
- Try switching to the other AI provider

**Auto-detection not working?**
- Enable auto-detection in settings
- Ensure you're working with supported file types
- Check if the file is saved

### Getting Help

- 📖 [Documentation](https://github.com/sarperarikan/accessimind-vscode/wiki)
- 🐛 [Report Issues](https://github.com/sarperarikan/accessimind-vscode/issues)
- 💬 [Discussions](https://github.com/sarperarikan/accessimind-vscode/discussions)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **WCAG Guidelines**: Based on W3C Web Content Accessibility Guidelines
- **Google Gemini**: AI-powered analysis capabilities
- **GitHub Copilot**: Code improvement suggestions
- **VS Code API**: Extension framework and integrations

## 🔮 Roadmap

- [ ] Support for more AI providers (Claude, GPT-4)
- [ ] Custom rule configuration
- [ ] Team collaboration features
- [ ] Accessibility testing automation
- [ ] Integration with popular frameworks
- [ ] Performance optimization
- [ ] More language translations

---

**Made with ♿ for a more accessible web**