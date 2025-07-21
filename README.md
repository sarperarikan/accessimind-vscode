# ♿ AccessiMind

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![VS Code](https://img.shields.io/badge/VS%20Code-1.74.0+-green)
![License](https://img.shields.io/badge/license-MIT-blue)

**Your AI-powered accessibility improvement tool for better web accessibility.**

**Developer:** Sarper Arıkan
**Email:** sarperarikan@gmail.com
**GitHub:** [@sarperarikan](https://github.com/sarperarikan)

AccessiMind is a sophisticated VS Code extension that leverages advanced AI models (Google Gemini and GitHub Copilot) to automatically analyze and improve your code for WCAG 2.2 compliance. Transform your web applications into accessible experiences with intelligent, real-time suggestions.

## 🚀 Key Features

### 🤖 **Multi-AI Provider Support**
- **Google Gemini API** - Advanced analysis with Gemini 2.0 Flash models
- **GitHub Copilot** - Dynamic model selection from available Copilot models
- **Smart Model Selection** - Choose from GPT-4o, Claude 3.5 Sonnet, and more

### 📄 **Intelligent Code Analysis**
- **Improve Entire File** - Comprehensive WCAG 2.2 analysis for complete files
- **Improve Code Selection** - Target specific code blocks for focused improvements
- **Smart Improvement** - Automatically detects selection or improves entire file
- **Real-time Processing** - Fast analysis with progress tracking

### 📊 **Comprehensive Statistics**
- **Daily/Monthly/Yearly Analytics** - Track your accessibility improvements over time
- **Language-based Statistics** - See which languages you're improving most
- **WCAG Criteria Tracking** - Monitor which accessibility standards you're addressing
- **Success Rate Monitoring** - Measure the effectiveness of your improvements
- **Export Functionality** - Save statistics as JSON for reporting

### 🔧 **Professional Features**
- **WCAG Level Support** - Target Level A, AA (recommended), or AAA compliance
- **Multi-language Support** - English and Turkish interface with auto-detection
- **File Type Coverage** - HTML, CSS, JavaScript, TypeScript, React, Vue, Angular, SCSS, LESS
- **Auto-apply Mode** - Enable automatic application of improvements for faster workflow
- **Visual Progress Tracking** - 6-step progress dialog with localized messages

## ⌨️ Quick Commands

| Shortcut | Command | Description |
|----------|---------|-------------|
| `Ctrl+Alt+W` | **Improve Current File** | Analyze and improve the entire active file |
| `Ctrl+Alt+Shift+W` | **Improve Selection** | Improve only the selected code block |
| `Ctrl+Alt+Q` | **Smart Improvement** | Auto-detect selection or improve whole file |
| `Ctrl+Alt+U` | **Show Statistics** | Display detailed analytics and insights |

## 🛠️ Installation & Setup

### 1. **Install Extension**
Download and install the AccessiMind extension from the marketplace or install the `.vsix` file.

### 2. **Configure AI Provider**
Choose your preferred AI provider through the Command Palette:

**Command Palette** → `WCAG: Set API Key`

#### Option A: Google Gemini
1. Select "Google Gemini" as your provider
2. Choose your preferred Gemini model:
   - **Gemini 2.0 Flash (Experimental)** - Fastest response time
   - **Gemini 2.0 Flash** - Balanced performance and quality
   - **Gemini 1.5 Flash** - Highest quality for complex improvements
3. Enter your Gemini API key (get one from [Google AI Studio](https://makersuite.google.com/))

#### Option B: GitHub Copilot
1. Select "VS Code Copilot" as your provider
2. Choose from available models (loaded dynamically):
   - **GPT-4o** - Latest OpenAI model with excellent code understanding
   - **GPT-4 Turbo** - Fast and efficient for code improvements
   - **GPT-3.5 Turbo** - Balanced performance for most use cases
   - **Claude 3.5 Sonnet** - Advanced reasoning for complex accessibility issues
3. Requires an active GitHub Copilot subscription

### 3. **Customize Settings**
Access settings via **VS Code Settings** → Search "WCAG":

- **WCAG Level**: Choose compliance level (A/AA/AAA)
- **Response Language**: Auto-detect, English, or Turkish
- **Auto-apply Mode**: Enable automatic application of improvements
- **Include Comments**: Add explanatory comments about improvements
- **Statistics Tracking**: Enable/disable usage analytics
- **Keyboard Shortcuts**: Customize all keyboard shortcuts for commands

#### **Keyboard Shortcut Customization**
You can customize all keyboard shortcuts in VS Code Settings:

1. Go to **Settings** → Search "AccessiMind Shortcuts"
2. Modify any of the following shortcuts:
   - `wcagEnhancer.shortcuts.improveFile` (default: Ctrl+Alt+W)
   - `wcagEnhancer.shortcuts.improveSelection` (default: Ctrl+Alt+Shift+W)
   - `wcagEnhancer.shortcuts.improveCurrentSelected` (default: Ctrl+Alt+Q)
   - `wcagEnhancer.shortcuts.showInterface` (default: Ctrl+Alt+U)
3. VS Code will prompt to reload after changes

## 📚 Welcome Experience

Upon first installation, AccessiMind presents a comprehensive welcome screen featuring:

- **Feature Overview** - Complete guide to all capabilities
- **Quick Setup Guide** - Step-by-step configuration instructions
- **Keyboard Shortcuts** - All available commands and shortcuts
- **Supported File Types** - Compatible languages and frameworks
- **WCAG Compliance Levels** - Understanding accessibility standards
- **Pro Tips** - Best practices for optimal workflow

## 🔍 Usage Examples

### Improving HTML Accessibility
```html
<!-- Before -->
<img src="hero.jpg">
<button onclick="submit()">Click</button>

<!-- After WCAG Enhancement -->
<img src="hero.jpg" alt="Hero banner showing our main product" role="img">
<button type="submit" onclick="submit()" aria-label="Submit form">Click</button>
```

### Enhancing Form Accessibility
```html
<!-- Before -->
<input type="email">
<input type="password">

<!-- After WCAG Enhancement -->
<label for="email">Email Address</label>
<input type="email" id="email" aria-required="true" aria-describedby="email-help">
<div id="email-help">We'll never share your email</div>

<label for="password">Password</label>
<input type="password" id="password" aria-required="true" minlength="8">
```

## 📊 Statistics Dashboard

Track your accessibility improvements with detailed analytics:

### Summary Metrics
- Total improvements made
- Lines of code enhanced
- Success rate percentage
- Average processing time
- Most improved language

### Time-based Analytics
- **Daily**: Today's improvement count and lines modified
- **Monthly**: Current month's accessibility enhancements
- **Yearly**: Annual progress tracking

### WCAG Criteria Coverage
Monitor which accessibility standards you're addressing:
- 1.x (Perceivable): Color contrast, alt text, captions
- 2.x (Operable): Keyboard navigation, focus management
- 3.x (Understandable): Clear language, consistent navigation
- 4.x (Robust): Valid markup, assistive technology compatibility

## 🌍 Multi-language Support

AccessiMind automatically detects your VS Code language settings:

- **English**: Complete interface and AI responses
- **Turkish**: Fully localized experience
- **Auto-detection**: Matches VS Code UI language

## 🔧 Supported File Types

- **Web Technologies**: HTML, CSS, SCSS, LESS
- **JavaScript Ecosystem**: JavaScript, TypeScript, JSX, TSX
- **Frameworks**: React, Vue, Angular, Svelte
- **Server-side**: PHP (basic support)

## 🎯 WCAG 2.2 Compliance Levels

### Level A (Basic)
Essential accessibility features that must be present for any content to be accessible.

### Level AA (Standard) ⭐ Recommended
The standard level for web accessibility, required by most accessibility laws and guidelines.

### Level AAA (Enhanced)
The highest level of accessibility, typically used for specialized content serving people with disabilities.

## 🚀 Pro Tips

1. **Use Auto-apply Mode** for faster development workflow
2. **Check Statistics Regularly** to track your accessibility progress
3. **Combine with Manual Testing** for comprehensive accessibility coverage
4. **Enable Explanatory Comments** to learn accessibility best practices
5. **Export Statistics** for team reporting and progress tracking

## 📈 Performance

- **Fast Analysis**: Average processing time under 2 seconds
- **Efficient Caching**: Smart model loading and reinitialization
- **Minimal Resource Usage**: Lightweight extension with small footprint
- **Real-time Updates**: Dynamic progress tracking with 6-step process

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=ai-accessibility-publisher.wcag-enhancer)
- [GitHub Repository](https://github.com/your-repo/wcag-enhancer)
- [Issue Tracker](https://github.com/your-repo/wcag-enhancer/issues)
- [Documentation](https://github.com/your-repo/wcag-enhancer/wiki)

## 📞 Support

Having issues? We're here to help:

- 📧 [Email Support](mailto:support@wcag-enhancer.com)
- 💬 [GitHub Discussions](https://github.com/your-repo/wcag-enhancer/discussions)
- 🐛 [Report Bugs](https://github.com/your-repo/wcag-enhancer/issues)

---

**Make the web accessible for everyone! 🌐♿**