"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WCAGDetectionService = void 0;
const vscode = require("vscode");
class WCAGDetectionService {
    constructor(settingsManager, aiServiceManager) {
        this.activeDetections = new Map();
        this.disposables = [];
        this.settingsManager = settingsManager;
        this.aiServiceManager = aiServiceManager;
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('wcag-accessibility');
        this.setupFileWatchers();
    }
    setupFileWatchers() {
        // Watch for file changes to trigger auto-detection
        const watcher = vscode.workspace.createFileSystemWatcher('**/*.{html,htm,css,js,ts,jsx,tsx,vue,svelte}', false, // don't ignore creates
        false, // don't ignore changes
        true // ignore deletes
        );
        watcher.onDidCreate(this.onFileChange.bind(this));
        watcher.onDidChange(this.onFileChange.bind(this));
        // Watch for active editor changes
        vscode.window.onDidChangeActiveTextEditor(this.onActiveEditorChange.bind(this));
        // Watch for document changes
        vscode.workspace.onDidChangeTextDocument(this.onDocumentChange.bind(this));
        this.disposables.push(watcher);
    }
    async onFileChange(uri) {
        const settings = await this.settingsManager.getAccessibilitySettings();
        if (settings.autoDetectIssues) {
            await this.detectIssuesInFile(uri);
        }
    }
    async onActiveEditorChange(editor) {
        if (!editor)
            return;
        const settings = await this.settingsManager.getAccessibilitySettings();
        if (settings.autoDetectIssues && this.isSupportedFile(editor.document.uri)) {
            await this.detectIssuesInFile(editor.document.uri);
        }
    }
    async onDocumentChange(event) {
        const settings = await this.settingsManager.getAccessibilitySettings();
        if (settings.autoDetectIssues && this.isSupportedFile(event.document.uri)) {
            // Debounce detection to avoid too frequent calls
            setTimeout(() => {
                this.detectIssuesInFile(event.document.uri);
            }, 1000);
        }
    }
    isSupportedFile(uri) {
        const supportedExtensions = ['.html', '.htm', '.css', '.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte'];
        return supportedExtensions.some(ext => uri.fsPath.toLowerCase().endsWith(ext));
    }
    async detectIssuesInFile(uri) {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const code = document.getText();
            if (!code.trim()) {
                return { issues: [], autoFixable: [], warnings: [], suggestions: [] };
            }
            // Use AI service for detection
            const analysisResult = await this.aiServiceManager.analyzeCode(code, uri.fsPath);
            // Process and categorize issues
            const detectionResult = this.categorizeIssues(analysisResult.issues);
            // Store result
            this.activeDetections.set(uri.fsPath, detectionResult);
            // Update VS Code diagnostics
            await this.updateDiagnostics(uri, detectionResult);
            // Show notification if needed
            await this.showNotificationIfNeeded(uri, detectionResult);
            return detectionResult;
        }
        catch (error) {
            console.error('Error detecting WCAG issues:', error);
            // Fallback to basic pattern-based detection
            return await this.basicPatternDetection(uri);
        }
    }
    categorizeIssues(issues) {
        const autoFixable = [];
        const warnings = [];
        const suggestions = [];
        issues.forEach(issue => {
            if (issue.severity === 'error' && this.isAutoFixable(issue)) {
                autoFixable.push(issue);
            }
            else if (issue.severity === 'warning') {
                warnings.push(issue);
            }
            // Generate suggestion
            const suggestion = this.generateSuggestion(issue);
            if (suggestion && !suggestions.includes(suggestion)) {
                suggestions.push(suggestion);
            }
        });
        return {
            issues,
            autoFixable,
            warnings,
            suggestions
        };
    }
    isAutoFixable(issue) {
        const autoFixableRules = [
            'WCAG 1.1.1',
            'WCAG 2.4.4',
            'WCAG 4.1.2',
            'WCAG 1.3.1' // Info and Relationships
        ];
        return autoFixableRules.some(rule => issue.rule.includes(rule));
    }
    generateSuggestion(issue) {
        const suggestions = {
            'WCAG 1.1.1': 'Add descriptive alt text to images',
            'WCAG 2.4.4': 'Provide clear and descriptive link text',
            'WCAG 4.1.2': 'Add proper ARIA labels to form elements',
            'WCAG 1.3.1': 'Use semantic HTML elements',
            'WCAG 2.1.1': 'Ensure all functionality is keyboard accessible',
            'WCAG 1.4.3': 'Increase color contrast ratio'
        };
        for (const [rule, suggestion] of Object.entries(suggestions)) {
            if (issue.rule.includes(rule)) {
                return suggestion;
            }
        }
        return 'Review accessibility compliance for this element';
    }
    async updateDiagnostics(uri, result) {
        const diagnostics = result.issues.map(issue => {
            const range = new vscode.Range(Math.max(0, issue.line - 1), Math.max(0, issue.column - 1), Math.max(0, issue.line - 1), Math.max(0, issue.column + 10) // Approximate end position
            );
            const severity = issue.severity === 'error'
                ? vscode.DiagnosticSeverity.Error
                : issue.severity === 'warning'
                    ? vscode.DiagnosticSeverity.Warning
                    : vscode.DiagnosticSeverity.Information;
            const diagnostic = new vscode.Diagnostic(range, issue.message, severity);
            diagnostic.code = issue.rule;
            diagnostic.source = 'AccessiMind WCAG';
            return diagnostic;
        });
        this.diagnosticCollection.set(uri, diagnostics);
    }
    async showNotificationIfNeeded(uri, result) {
        const settings = await this.settingsManager.getAccessibilitySettings();
        if (result.issues.length > 0 && settings.enableVoiceAnnouncements) {
            const errorCount = result.issues.filter(i => i.severity === 'error').length;
            const warningCount = result.issues.filter(i => i.severity === 'warning').length;
            const message = settings.language === 'en'
                ? `Found ${errorCount} accessibility errors and ${warningCount} warnings`
                : `${errorCount} erişilebilirlik hatası ve ${warningCount} uyarı bulundu`;
            // Show as information message
            vscode.window.showInformationMessage(`♿ ${message}`);
        }
    }
    async basicPatternDetection(uri) {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const code = document.getText();
            const issues = [];
            const lines = code.split('\n');
            lines.forEach((line, index) => {
                // Check for images without alt text
                if (line.includes('<img') && !line.includes('alt=')) {
                    issues.push({
                        line: index + 1,
                        column: line.indexOf('<img'),
                        severity: 'error',
                        rule: 'WCAG 1.1.1',
                        message: 'Image missing alt attribute',
                        wcagLevel: 'A'
                    });
                }
                // Check for inputs without labels
                if (line.includes('<input') && !line.includes('aria-label') && !line.includes('id=')) {
                    issues.push({
                        line: index + 1,
                        column: line.indexOf('<input'),
                        severity: 'warning',
                        rule: 'WCAG 4.1.2',
                        message: 'Form input may be missing accessible label',
                        wcagLevel: 'A'
                    });
                }
                // Check for buttons without accessible text
                if (line.includes('<button') && !line.includes('aria-label') && !line.match(/>.*?</)) {
                    issues.push({
                        line: index + 1,
                        column: line.indexOf('<button'),
                        severity: 'warning',
                        rule: 'WCAG 2.4.4',
                        message: 'Button may be missing accessible text',
                        wcagLevel: 'A'
                    });
                }
            });
            return this.categorizeIssues(issues);
        }
        catch (error) {
            console.error('Basic pattern detection failed:', error);
            return { issues: [], autoFixable: [], warnings: [], suggestions: [] };
        }
    }
    async getDetectionResult(uri) {
        return this.activeDetections.get(uri.fsPath);
    }
    async autoFixIssues(uri) {
        const result = this.activeDetections.get(uri.fsPath);
        if (!result || result.autoFixable.length === 0) {
            return false;
        }
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const code = document.getText();
            const improvement = await this.aiServiceManager.improveCode(code, uri.fsPath, result.autoFixable);
            // Apply improvements
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(code.length));
            edit.replace(uri, fullRange, improvement.improvedCode);
            const applied = await vscode.workspace.applyEdit(edit);
            if (applied) {
                // Re-detect to update diagnostics
                await this.detectIssuesInFile(uri);
                const settings = await this.settingsManager.getAccessibilitySettings();
                const message = settings.language === 'en'
                    ? `Auto-fixed ${result.autoFixable.length} accessibility issues`
                    : `${result.autoFixable.length} erişilebilirlik sorunu otomatik düzeltildi`;
                vscode.window.showInformationMessage(`♿ ${message}`);
            }
            return applied;
        }
        catch (error) {
            console.error('Auto-fix failed:', error);
            return false;
        }
    }
    dispose() {
        this.diagnosticCollection.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
exports.WCAGDetectionService = WCAGDetectionService;
//# sourceMappingURL=WCAGDetectionService.js.map