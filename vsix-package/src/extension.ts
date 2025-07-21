import * as vscode from 'vscode';
import { SettingsManager } from './settings/SettingsManager';
import { TabbedMainViewProvider } from './providers/TabbedMainViewProvider';
import { DynamicPanelProvider } from './providers/DynamicPanelProvider';
import { StatsViewProvider } from './providers/StatsViewProvider';
import { WizardWebviewProvider } from './providers/WizardWebviewProvider';
import { AIServiceManager } from './services/AIServiceManager';
import { WCAGDetectionService } from './services/WCAGDetectionService';

let settingsManager: SettingsManager;
let aiServiceManager: AIServiceManager;
let wcagDetectionService: WCAGDetectionService;

export function activate(context: vscode.ExtensionContext) {
    console.log('AccessiMind extension is being activated...');

    // Initialize core services
    settingsManager = new SettingsManager(context);
    aiServiceManager = new AIServiceManager(settingsManager);
    wcagDetectionService = new WCAGDetectionService(settingsManager, aiServiceManager);

    // Initialize services
    initializeServices(context);

    // Check first time setup and show wizard if needed
    checkFirstTimeSetup(context);

    // Register view providers
    registerViewProviders(context);

    // Register commands
    registerCommands(context);

    // Setup auto-detection if enabled
    setupAutoDetection(context);

    console.log('AccessiMind extension activated successfully!');
}

async function initializeServices(context: vscode.ExtensionContext) {
    try {
        // Initialize AI services
        await aiServiceManager.initialize();
        
        // Add to disposables
        context.subscriptions.push(wcagDetectionService);
        
    } catch (error) {
        console.error('Failed to initialize services:', error);
    }
}

async function checkFirstTimeSetup(context: vscode.ExtensionContext) {
    const isFirstTime = await settingsManager.isFirstTimeSetup();
    
    if (isFirstTime) {
        // Show setup wizard automatically for first time
        vscode.commands.executeCommand('wcagEnhancer.showWizard');
    }
}

async function setupAutoDetection(context: vscode.ExtensionContext) {
    const settings = await settingsManager.getAccessibilitySettings();
    
    if (settings.autoDetectIssues) {
        // Start auto-detection for current workspace
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            for (const folder of workspaceFolders) {
                const files = await vscode.workspace.findFiles(
                    new vscode.RelativePattern(folder, '**/*.{html,htm,css,js,ts,jsx,tsx,vue,svelte}'),
                    '**/node_modules/**',
                    10 // Limit initial scan
                );
                
                // Process files in background
                files.forEach(async (file) => {
                    try {
                        await wcagDetectionService.detectIssuesInFile(file);
                    } catch (error) {
                        console.warn('Auto-detection failed for file:', file.fsPath, error);
                    }
                });
            }
        }
    }
}

function registerViewProviders(context: vscode.ExtensionContext) {
    // Main tabbed view provider
    const tabbedProvider = new TabbedMainViewProvider(context.extensionUri, settingsManager);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('accessimind.tabbedMainView', tabbedProvider)
    );

    // Dynamic panel provider - main action buttons
    const dynamicProvider = new DynamicPanelProvider(context.extensionUri, settingsManager);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('accessimind.dynamicPanelView', dynamicProvider)
    );

    // Statistics view provider
    const statsProvider = new StatsViewProvider(context.extensionUri, settingsManager);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('accessimind.statsView', statsProvider)
    );
}

function registerCommands(context: vscode.ExtensionContext) {
    // Core analysis commands
    const analyzeCommand = vscode.commands.registerCommand('accessimind.analyzeCode', async () => {
        await analyzeCurrentCode();
    });

    const improveCommand = vscode.commands.registerCommand('accessimind.improveCode', async () => {
        await improveCurrentCode();
    });

    const wizardCommand = vscode.commands.registerCommand('accessimind.showWizard', async () => {
        await showSetupWizard(context);
    });

    // Enhanced commands
    const autoDetectCommand = vscode.commands.registerCommand('accessimind.autoDetectWCAG', async () => {
        await autoDetectIssues();
    });

    const setDetailLevelCommand = vscode.commands.registerCommand('accessimind.setDetailLevel', async () => {
        await setDetailLevel();
    });

    const endToEndImproveCommand = vscode.commands.registerCommand('accessimind.endToEndImprove', async () => {
        await endToEndImprovement();
    });

    // New specific commands
    const improveCurrentFileCommand = vscode.commands.registerCommand('accessimind.improveCurrentFile', async () => {
        await improveCurrentFile();
    });

    const improveSelectedCodeCommand = vscode.commands.registerCommand('accessimind.improveSelectedCode', async () => {
        await improveSelectedCode();
    });

    const createJiraTaskCommand = vscode.commands.registerCommand('accessimind.createJiraTask', async () => {
        await createJiraTaskFromCurrentFile();
    });

    const createJiraTaskFromSelectionCommand = vscode.commands.registerCommand('accessimind.createJiraTaskFromSelection', async () => {
        await createJiraTaskFromSelection();
    });

    const showStatisticsCommand = vscode.commands.registerCommand('accessimind.showStatistics', async () => {
        await showStatistics();
    });

    context.subscriptions.push(
        analyzeCommand,
        improveCommand,
        wizardCommand,
        autoDetectCommand,
        setDetailLevelCommand,
        endToEndImproveCommand,
        improveCurrentFileCommand,
        improveSelectedCodeCommand,
        createJiraTaskCommand,
        createJiraTaskFromSelectionCommand,
        showStatisticsCommand
    );
}

async function autoDetectIssues() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        const settings = await settingsManager.getAccessibilitySettings();
        const message = settings.language === 'en'
            ? 'No active file found to scan.'
            : 'Taranacak aktif dosya bulunamadı.';
        vscode.window.showWarningMessage(message);
        return;
    }

    try {
        const settings = await settingsManager.getAccessibilitySettings();
        const startMessage = settings.language === 'en'
            ? 'Starting automatic WCAG detection...'
            : 'Otomatik WCAG tespiti başlatılıyor...';
        
        vscode.window.showInformationMessage(`♿ ${startMessage}`);
        
        const result = await wcagDetectionService.detectIssuesInFile(editor.document.uri);
        
        const issueCount = result.issues.length;
        const autoFixCount = result.autoFixable.length;
        
        const completedMessage = settings.language === 'en'
            ? `Detection completed! Found ${issueCount} issues (${autoFixCount} auto-fixable).`
            : `Tespit tamamlandı! ${issueCount} sorun bulundu (${autoFixCount} otomatik düzeltilebilir).`;
        
        if (autoFixCount > 0) {
            const fixText = settings.language === 'en' ? 'Auto-Fix Issues' : 'Sorunları Otomatik Düzelt';
            const action = await vscode.window.showInformationMessage(
                `♿ ${completedMessage}`,
                fixText
            );
            
            if (action === fixText) {
                await wcagDetectionService.autoFixIssues(editor.document.uri);
            }
        } else {
            vscode.window.showInformationMessage(`♿ ${completedMessage}`);
        }
        
    } catch (error) {
        console.error('Auto-detection failed:', error);
        const settings = await settingsManager.getAccessibilitySettings();
        const errorMessage = settings.language === 'en'
            ? 'Auto-detection failed. Please check your configuration.'
            : 'Otomatik tespit başarısız. Lütfen yapılandırmanızı kontrol edin.';
        vscode.window.showErrorMessage(`♿ ${errorMessage}`);
    }
}

async function setDetailLevel() {
    const settings = await settingsManager.getAccessibilitySettings();
    
    const options = [
        {
            label: 'Basic',
            detail: settings.language === 'en'
                ? 'Essential accessibility issues only'
                : 'Sadece temel erişilebilirlik sorunları',
            value: 'basic'
        },
        {
            label: 'Detailed',
            detail: settings.language === 'en'
                ? 'Comprehensive analysis with explanations'
                : 'Açıklamalarla kapsamlı analiz',
            value: 'detailed'
        },
        {
            label: 'Comprehensive',
            detail: settings.language === 'en'
                ? 'In-depth analysis with code examples'
                : 'Kod örnekleriyle derinlemesine analiz',
            value: 'comprehensive'
        }
    ];

    const selected = await vscode.window.showQuickPick(options, {
        placeHolder: settings.language === 'en'
            ? 'Select detail level for WCAG analysis'
            : 'WCAG analizi için detay seviyesi seçin'
    });

    if (selected) {
        const newSettings = { ...settings, detailLevel: selected.value as 'basic' | 'detailed' | 'comprehensive' };
        await settingsManager.setAccessibilitySettings(newSettings);
        
        const message = settings.language === 'en'
            ? `Detail level set to: ${selected.label}`
            : `Detay seviyesi ayarlandı: ${selected.label}`;
        vscode.window.showInformationMessage(`♿ ${message}`);
    }
}

async function endToEndImprovement() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        const settings = await settingsManager.getAccessibilitySettings();
        const message = settings.language === 'en'
            ? 'No active file found to improve.'
            : 'İyileştirilecek aktif dosya bulunamadı.';
        vscode.window.showWarningMessage(message);
        return;
    }

    // Check AI provider settings
    const hasValidSettings = await settingsManager.hasValidAISettings();
    if (!hasValidSettings) {
        const settings = await settingsManager.getAccessibilitySettings();
        const message = settings.language === 'en'
            ? 'AI provider settings not configured. Would you like to configure them?'
            : 'AI sağlayıcısı ayarları yapılandırılmamış. Ayarları yapmak ister misiniz?';
        const buttonText = settings.language === 'en' ? 'Configure Settings' : 'Ayarları Yap';
        
        const result = await vscode.window.showWarningMessage(message, buttonText);
        if (result === buttonText) {
            vscode.commands.executeCommand('wcagEnhancer.showWizard');
        }
        return;
    }

    try {
        const settings = await settingsManager.getAccessibilitySettings();
        const startMessage = settings.language === 'en'
            ? 'Starting comprehensive accessibility enhancement...'
            : 'Kapsamlı erişilebilirlik iyileştirmesi başlatılıyor...';
        
        // Show progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `♿ ${startMessage}`,
            cancellable: false
        }, async (progress) => {
            
            progress.report({ increment: 25, message: settings.language === 'en' ? 'Analyzing code...' : 'Kod analiz ediliyor...' });
            
            const code = editor.document.getText();
            const result = await aiServiceManager.endToEndImprovement(code, editor.document.uri.fsPath);
            
            progress.report({ increment: 50, message: settings.language === 'en' ? 'Generating improvements...' : 'İyileştirmeler üretiliyor...' });
            
            // Show comprehensive results
            const analysisIssues = result.analysis.issues.length;
            const improvementsMade = result.improvement.changes.length;
            
            progress.report({ increment: 75, message: settings.language === 'en' ? 'Preparing results...' : 'Sonuçlar hazırlanıyor...' });
            
            const summaryMessage = settings.language === 'en'
                ? `Analysis complete: ${analysisIssues} issues found, ${improvementsMade} improvements made.`
                : `Analiz tamamlandı: ${analysisIssues} sorun bulundu, ${improvementsMade} iyileştirme yapıldı.`;
            
            const applyText = settings.language === 'en' ? 'Apply All Improvements' : 'Tüm İyileştirmeleri Uygula';
            const showDetailsText = settings.language === 'en' ? 'Show Details' : 'Detayları Göster';
            
            progress.report({ increment: 100, message: settings.language === 'en' ? 'Complete!' : 'Tamamlandı!' });
            
            const action = await vscode.window.showInformationMessage(
                `♿ ${summaryMessage}`,
                applyText,
                showDetailsText
            );
            
            if (action === applyText) {
                // Apply all improvements
                const edit = new vscode.WorkspaceEdit();
                const fullRange = new vscode.Range(
                    editor.document.positionAt(0),
                    editor.document.positionAt(code.length)
                );
                edit.replace(editor.document.uri, fullRange, result.finalCode);
                
                const applied = await vscode.workspace.applyEdit(edit);
                if (applied) {
                    await settingsManager.incrementUsageStats('improve');
                    const successMessage = settings.language === 'en'
                        ? 'All accessibility improvements applied successfully!'
                        : 'Tüm erişilebilirlik iyileştirmeleri başarıyla uygulandı!';
                    vscode.window.showInformationMessage(`♿ ${successMessage}`);
                    
                    // Re-run detection to show final state
                    await wcagDetectionService.detectIssuesInFile(editor.document.uri);
                }
            } else if (action === showDetailsText) {
                // Show detailed results in output channel
                const output = vscode.window.createOutputChannel('AccessiMind - Enhancement Results');
                output.clear();
                output.appendLine('=== ACCESSIBILITY ENHANCEMENT RESULTS ===\n');
                output.appendLine(`Analysis Summary: ${result.analysis.summary}\n`);
                output.appendLine(`Improvement Explanation: ${result.improvement.explanation}\n`);
                output.appendLine('=== CHANGES MADE ===');
                
                result.improvement.changes.forEach((change, index) => {
                    output.appendLine(`${index + 1}. Line ${change.line}: ${change.description}`);
                    if (change.wcagRule) {
                        output.appendLine(`   WCAG Rule: ${change.wcagRule}`);
                    }
                });
                
                output.show();
            }
        });
        
    } catch (error) {
        console.error('End-to-end improvement failed:', error);
        await aiServiceManager.handleServiceError(error, 'endToEndImprovement');
    }
}

async function improveCurrentFile() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        const settings = await settingsManager.getAccessibilitySettings();
        const message = settings.language === 'en'
            ? 'No active file found to improve.'
            : 'İyileştirilecek aktif dosya bulunamadı.';
        vscode.window.showWarningMessage(message);
        return;
    }

    // Check AI provider settings
    const hasValidSettings = await settingsManager.hasValidAISettings();
    if (!hasValidSettings) {
        const settings = await settingsManager.getAccessibilitySettings();
        const message = settings.language === 'en'
            ? 'AI provider settings not configured. Would you like to configure them?'
            : 'AI sağlayıcısı ayarları yapılandırılmamış. Ayarları yapmak ister misiniz?';
        const buttonText = settings.language === 'en' ? 'Configure Settings' : 'Ayarları Yap';
        
        const result = await vscode.window.showWarningMessage(message, buttonText);
        if (result === buttonText) {
            vscode.commands.executeCommand('accessimind.showWizard');
        }
        return;
    }

    try {
        const settings = await settingsManager.getAccessibilitySettings();
        const startMessage = settings.language === 'en'
            ? 'Improving entire file...'
            : 'Tüm dosya iyileştiriliyor...';
        
        vscode.window.showInformationMessage(`♿ ${startMessage}`);
        
        const code = editor.document.getText();
        const result = await aiServiceManager.improveCode(code, editor.document.uri.fsPath);
        
        // Apply improvements directly
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
            editor.document.positionAt(0),
            editor.document.positionAt(code.length)
        );
        edit.replace(editor.document.uri, fullRange, result.improvedCode);
        
        const applied = await vscode.workspace.applyEdit(edit);
        if (applied) {
            await settingsManager.incrementUsageStats('improve');
            const successMessage = settings.language === 'en'
                ? 'File accessibility improvements applied successfully!'
                : 'Dosya erişilebilirlik iyileştirmeleri başarıyla uygulandı!';
            vscode.window.showInformationMessage(`♿ ${successMessage}`);
        }
        
    } catch (error) {
        console.error('File improvement failed:', error);
        await aiServiceManager.handleServiceError(error, 'improveCurrentFile');
    }
}

async function improveSelectedCode() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        const settings = await settingsManager.getAccessibilitySettings();
        const message = settings.language === 'en'
            ? 'No active file found.'
            : 'Aktif dosya bulunamadı.';
        vscode.window.showWarningMessage(message);
        return;
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
        const settings = await settingsManager.getAccessibilitySettings();
        const message = settings.language === 'en'
            ? 'No code selected. Please select code to improve.'
            : 'Kod seçilmedi. Lütfen iyileştirilecek kodu seçin.';
        vscode.window.showWarningMessage(message);
        return;
    }

    // Check AI provider settings
    const hasValidSettings = await settingsManager.hasValidAISettings();
    if (!hasValidSettings) {
        const settings = await settingsManager.getAccessibilitySettings();
        const message = settings.language === 'en'
            ? 'AI provider settings not configured. Would you like to configure them?'
            : 'AI sağlayıcısı ayarları yapılandırılmamış. Ayarları yapmak ister misiniz?';
        const buttonText = settings.language === 'en' ? 'Configure Settings' : 'Ayarları Yap';
        
        const result = await vscode.window.showWarningMessage(message, buttonText);
        if (result === buttonText) {
            vscode.commands.executeCommand('accessimind.showWizard');
        }
        return;
    }

    try {
        const settings = await settingsManager.getAccessibilitySettings();
        const startMessage = settings.language === 'en'
            ? 'Improving selected code...'
            : 'Seçili kod iyileştiriliyor...';
        
        vscode.window.showInformationMessage(`♿ ${startMessage}`);
        
        const selectedCode = editor.document.getText(selection);
        const result = await aiServiceManager.improveCode(selectedCode, editor.document.uri.fsPath);
        
        // Apply improvements to selected area
        const edit = new vscode.WorkspaceEdit();
        edit.replace(editor.document.uri, selection, result.improvedCode);
        
        const applied = await vscode.workspace.applyEdit(edit);
        if (applied) {
            await settingsManager.incrementUsageStats('improve');
            const successMessage = settings.language === 'en'
                ? 'Selected code accessibility improvements applied successfully!'
                : 'Seçili kod erişilebilirlik iyileştirmeleri başarıyla uygulandı!';
            vscode.window.showInformationMessage(`♿ ${successMessage}`);
        }
        
    } catch (error) {
        console.error('Selected code improvement failed:', error);
        await aiServiceManager.handleServiceError(error, 'improveSelectedCode');
    }
}

async function createJiraTaskFromCurrentFile() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        const settings = await settingsManager.getAccessibilitySettings();
        const message = settings.language === 'en'
            ? 'No active file found.'
            : 'Aktif dosya bulunamadı.';
        vscode.window.showWarningMessage(message);
        return;
    }

    try {
        const settings = await settingsManager.getAccessibilitySettings();
        const startMessage = settings.language === 'en'
            ? 'Analyzing file for Jira task creation...'
            : 'Jira görevi oluşturmak için dosya analiz ediliyor...';
        
        vscode.window.showInformationMessage(`♿ ${startMessage}`);
        
        const code = editor.document.getText();
        const analysisResult = await aiServiceManager.analyzeCode(code, editor.document.uri.fsPath);
        
        // Create Jira task content
        const fileName = editor.document.uri.fsPath.split('/').pop() || 'Unknown File';
        const issueCount = analysisResult.issues.length;
        
        const taskTitle = `Accessibility Issues in ${fileName}`;
        const taskDescription = `File: ${fileName}
Issues Found: ${issueCount}

${analysisResult.summary}

Issues:
${analysisResult.issues.map(issue => `- Line ${issue.line}: ${issue.message} (${issue.rule})`).join('\n')}

Suggestions:
${analysisResult.suggestions.map(suggestion => `- ${suggestion.title}: ${suggestion.description}`).join('\n')}`;

        // Get Jira configuration
        const jiraUrl = vscode.workspace.getConfiguration('accessimind').get<string>('jiraUrl', '');
        const jiraProject = vscode.workspace.getConfiguration('accessimind').get<string>('jiraProject', '');
        
        if (!jiraUrl || !jiraProject) {
            const configMessage = settings.language === 'en'
                ? 'Jira URL and Project not configured. Please configure in settings.'
                : 'Jira URL ve Proje yapılandırılmamış. Lütfen ayarlarda yapılandırın.';
            vscode.window.showWarningMessage(configMessage);
            return;
        }

        // Show task content and option to open in Jira
        const openJiraText = settings.language === 'en' ? 'Open in Jira' : 'Jira\'da Aç';
        const copyText = settings.language === 'en' ? 'Copy Content' : 'İçeriği Kopyala';
        
        const action = await vscode.window.showInformationMessage(
            `♿ ${settings.language === 'en' ? 'Jira task content prepared!' : 'Jira görevi içeriği hazırlandı!'}`,
            openJiraText,
            copyText
        );
        
        if (action === copyText) {
            await vscode.env.clipboard.writeText(`${taskTitle}\n\n${taskDescription}`);
            const copiedMessage = settings.language === 'en'
                ? 'Task content copied to clipboard!'
                : 'Görev içeriği panoya kopyalandı!';
            vscode.window.showInformationMessage(`♿ ${copiedMessage}`);
        } else if (action === openJiraText) {
            const jiraCreateUrl = `${jiraUrl}/secure/CreateIssue.jspa?pid=${jiraProject}&issuetype=10004`;
            vscode.env.openExternal(vscode.Uri.parse(jiraCreateUrl));
        }
        
    } catch (error) {
        console.error('Jira task creation failed:', error);
        await aiServiceManager.handleServiceError(error, 'createJiraTaskFromCurrentFile');
    }
}

async function createJiraTaskFromSelection() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        const settings = await settingsManager.getAccessibilitySettings();
        const message = settings.language === 'en'
            ? 'No active file found.'
            : 'Aktif dosya bulunamadı.';
        vscode.window.showWarningMessage(message);
        return;
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
        const settings = await settingsManager.getAccessibilitySettings();
        const message = settings.language === 'en'
            ? 'No code selected. Please select code to analyze.'
            : 'Kod seçilmedi. Lütfen analiz edilecek kodu seçin.';
        vscode.window.showWarningMessage(message);
        return;
    }

    try {
        const settings = await settingsManager.getAccessibilitySettings();
        const startMessage = settings.language === 'en'
            ? 'Analyzing selection for Jira task creation...'
            : 'Jira görevi oluşturmak için seçim analiz ediliyor...';
        
        vscode.window.showInformationMessage(`♿ ${startMessage}`);
        
        const selectedCode = editor.document.getText(selection);
        const analysisResult = await aiServiceManager.analyzeCode(selectedCode, editor.document.uri.fsPath);
        
        // Create Jira task content
        const fileName = editor.document.uri.fsPath.split('/').pop() || 'Unknown File';
        const startLine = selection.start.line + 1;
        const endLine = selection.end.line + 1;
        const issueCount = analysisResult.issues.length;
        
        const taskTitle = `Accessibility Issues in ${fileName} (Lines ${startLine}-${endLine})`;
        const taskDescription = `File: ${fileName}
Lines: ${startLine}-${endLine}
Issues Found: ${issueCount}

${analysisResult.summary}

Selected Code:
\`\`\`
${selectedCode}
\`\`\`

Issues:
${analysisResult.issues.map(issue => `- Line ${issue.line}: ${issue.message} (${issue.rule})`).join('\n')}

Suggestions:
${analysisResult.suggestions.map(suggestion => `- ${suggestion.title}: ${suggestion.description}`).join('\n')}`;

        // Get Jira configuration
        const jiraUrl = vscode.workspace.getConfiguration('accessimind').get<string>('jiraUrl', '');
        const jiraProject = vscode.workspace.getConfiguration('accessimind').get<string>('jiraProject', '');
        
        if (!jiraUrl || !jiraProject) {
            const configMessage = settings.language === 'en'
                ? 'Jira URL and Project not configured. Please configure in settings.'
                : 'Jira URL ve Proje yapılandırılmamış. Lütfen ayarlarda yapılandırın.';
            vscode.window.showWarningMessage(configMessage);
            return;
        }

        // Show task content and option to open in Jira
        const openJiraText = settings.language === 'en' ? 'Open in Jira' : 'Jira\'da Aç';
        const copyText = settings.language === 'en' ? 'Copy Content' : 'İçeriği Kopyala';
        
        const action = await vscode.window.showInformationMessage(
            `♿ ${settings.language === 'en' ? 'Jira task content prepared!' : 'Jira görevi içeriği hazırlandı!'}`,
            openJiraText,
            copyText
        );
        
        if (action === copyText) {
            await vscode.env.clipboard.writeText(`${taskTitle}\n\n${taskDescription}`);
            const copiedMessage = settings.language === 'en'
                ? 'Task content copied to clipboard!'
                : 'Görev içeriği panoya kopyalandı!';
            vscode.window.showInformationMessage(`♿ ${copiedMessage}`);
        } else if (action === openJiraText) {
            const jiraCreateUrl = `${jiraUrl}/secure/CreateIssue.jspa?pid=${jiraProject}&issuetype=10004`;
            vscode.env.openExternal(vscode.Uri.parse(jiraCreateUrl));
        }
        
    } catch (error) {
        console.error('Jira task creation from selection failed:', error);
        await aiServiceManager.handleServiceError(error, 'createJiraTaskFromSelection');
    }
}

async function showStatistics() {
    try {
        const settings = await settingsManager.getAccessibilitySettings();
        const stats = await settingsManager.getUsageStats();
        
        // Create statistics content
        const totalAnalyzes = stats.totalAnalyzes;
        const totalImprovements = stats.totalImprovements;
        const lastUsed = stats.lastUsed.toLocaleDateString();
        const installDate = stats.installDate.toLocaleDateString();
        const daysSinceInstall = Math.floor((Date.now() - stats.installDate.getTime()) / (1000 * 60 * 60 * 24));
        
        const title = settings.language === 'en' ? 'AccessiMind Statistics' : 'AccessiMind İstatistikleri';
        
        const statisticsContent = settings.language === 'en' ? `
# AccessiMind Usage Statistics

## General Statistics
- **Total Analyses**: ${totalAnalyzes}
- **Total Improvements**: ${totalImprovements}
- **Last Used**: ${lastUsed}
- **Install Date**: ${installDate}
- **Days Since Install**: ${daysSinceInstall}

## Usage Patterns
- **Average Analyses per Day**: ${daysSinceInstall > 0 ? (totalAnalyzes / daysSinceInstall).toFixed(2) : '0'}
- **Average Improvements per Day**: ${daysSinceInstall > 0 ? (totalImprovements / daysSinceInstall).toFixed(2) : '0'}
- **Improvement Rate**: ${totalAnalyzes > 0 ? ((totalImprovements / totalAnalyzes) * 100).toFixed(1) : '0'}%

## Accessibility Impact
- **Estimated Issues Detected**: ${totalAnalyzes * 3.2} (average)
- **Estimated Issues Fixed**: ${totalImprovements * 2.8} (average)
- **Accessibility Score Improvement**: ${totalImprovements * 15}% (estimated)

---
*Statistics are updated in real-time and stored locally.*
        ` : `
# AccessiMind Kullanım İstatistikleri

## Genel İstatistikler
- **Toplam Analiz**: ${totalAnalyzes}
- **Toplam İyileştirme**: ${totalImprovements}
- **Son Kullanım**: ${lastUsed}
- **Kurulum Tarihi**: ${installDate}
- **Kurulumdan Beri Geçen Gün**: ${daysSinceInstall}

## Kullanım Desenleri
- **Günlük Ortalama Analiz**: ${daysSinceInstall > 0 ? (totalAnalyzes / daysSinceInstall).toFixed(2) : '0'}
- **Günlük Ortalama İyileştirme**: ${daysSinceInstall > 0 ? (totalImprovements / daysSinceInstall).toFixed(2) : '0'}
- **İyileştirme Oranı**: ${totalAnalyzes > 0 ? ((totalImprovements / totalAnalyzes) * 100).toFixed(1) : '0'}%

## Erişilebilirlik Etkisi
- **Tahmini Tespit Edilen Sorun**: ${totalAnalyzes * 3.2} (ortalama)
- **Tahmini Düzeltilen Sorun**: ${totalImprovements * 2.8} (ortalama)
- **Erişilebilirlik Skor İyileştirme**: ${totalImprovements * 15}% (tahmini)

---
*İstatistikler gerçek zamanlı güncellenir ve yerel olarak saklanır.*
        `;

        // Show statistics in a new document
        const doc = await vscode.workspace.openTextDocument({
            content: statisticsContent,
            language: 'markdown'
        });
        
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
        
        const successMessage = settings.language === 'en'
            ? 'Statistics displayed successfully!'
            : 'İstatistikler başarıyla görüntülendi!';
        vscode.window.showInformationMessage(`♿ ${successMessage}`);
        
    } catch (error) {
        console.error('Statistics display failed:', error);
        const settings = await settingsManager.getAccessibilitySettings();
        const errorMessage = settings.language === 'en'
            ? 'Failed to display statistics.'
            : 'İstatistikler görüntülenemedi.';
        vscode.window.showErrorMessage(`♿ ${errorMessage}`);
    }
}

async function analyzeCurrentCode() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        const settings = await settingsManager.getAccessibilitySettings();
        const message = settings.language === 'en'
            ? 'No active file found to analyze.'
            : 'Analiz edilecek aktif bir dosya bulunamadı.';
        vscode.window.showWarningMessage(message);
        return;
    }

    // Check AI provider settings
    const hasValidSettings = await settingsManager.hasValidAISettings();
    if (!hasValidSettings) {
        const settings = await settingsManager.getAccessibilitySettings();
        const message = settings.language === 'en'
            ? 'AI provider settings not configured. Would you like to configure them?'
            : 'AI sağlayıcısı ayarları yapılandırılmamış. Ayarları yapmak ister misiniz?';
        const buttonText = settings.language === 'en' ? 'Configure Settings' : 'Ayarları Yap';
        
        const result = await vscode.window.showWarningMessage(message, buttonText);
        if (result === buttonText) {
            vscode.commands.executeCommand('wcagEnhancer.showWizard');
        }
        return;
    }

    try {
        const settings = await settingsManager.getAccessibilitySettings();
        const startMessage = settings.language === 'en'
            ? 'Starting accessibility analysis...'
            : 'Erişilebilirlik analizi başlatılıyor...';
        
        vscode.window.showInformationMessage(`♿ ${startMessage}`);
        
        const code = editor.document.getText();
        const result = await aiServiceManager.analyzeCode(code, editor.document.uri.fsPath);
        
        // Update statistics
        await settingsManager.incrementUsageStats('analyze');
        
        // Show results
        const issueCount = result.issues.length;
        const completedMessage = settings.language === 'en'
            ? `Analysis completed! Found ${issueCount} accessibility issues.`
            : `Analiz tamamlandı! ${issueCount} erişilebilirlik sorunu bulundu.`;
        
        vscode.window.showInformationMessage(`♿ ${completedMessage}`);
        
        // Trigger auto-detection to update diagnostics
        await wcagDetectionService.detectIssuesInFile(editor.document.uri);
        
    } catch (error) {
        console.error('Analysis failed:', error);
        await aiServiceManager.handleServiceError(error, 'analyzeCurrentCode');
    }
}

async function improveCurrentCode() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        const settings = await settingsManager.getAccessibilitySettings();
        const message = settings.language === 'en'
            ? 'No active file found to improve.'
            : 'İyileştirilecek aktif bir dosya bulunamadı.';
        vscode.window.showWarningMessage(message);
        return;
    }

    // Check AI provider settings
    const hasValidSettings = await settingsManager.hasValidAISettings();
    if (!hasValidSettings) {
        const settings = await settingsManager.getAccessibilitySettings();
        const message = settings.language === 'en'
            ? 'AI provider settings not configured. Would you like to configure them?'
            : 'AI sağlayıcısı ayarları yapılandırılmamış. Ayarları yapmak ister misiniz?';
        const buttonText = settings.language === 'en' ? 'Configure Settings' : 'Ayarları Yap';
        
        const result = await vscode.window.showWarningMessage(message, buttonText);
        if (result === buttonText) {
            vscode.commands.executeCommand('wcagEnhancer.showWizard');
        }
        return;
    }

    try {
        const settings = await settingsManager.getAccessibilitySettings();
        const startMessage = settings.language === 'en'
            ? 'Starting code improvement...'
            : 'Kod iyileştirme başlatılıyor...';
        
        vscode.window.showInformationMessage(`♿ ${startMessage}`);
        
        const code = editor.document.getText();
        
        // Get existing issues for context
        const detectionResult = await wcagDetectionService.getDetectionResult(editor.document.uri);
        const issues = detectionResult?.issues || [];
        
        const result = await aiServiceManager.improveCode(code, editor.document.uri.fsPath, issues);
        
        // Show improvement options
        const applyText = settings.language === 'en' ? 'Apply Improvements' : 'İyileştirmeleri Uygula';
        const previewText = settings.language === 'en' ? 'Preview Changes' : 'Değişiklikleri Önizle';
        
        const action = await vscode.window.showInformationMessage(
            `♿ ${settings.language === 'en' ? 'Code improvements ready!' : 'Kod iyileştirmeleri hazır!'}`,
            applyText,
            previewText
        );
        
        if (action === applyText) {
            // Apply improvements directly
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                editor.document.positionAt(0),
                editor.document.positionAt(code.length)
            );
            edit.replace(editor.document.uri, fullRange, result.improvedCode);
            
            const applied = await vscode.workspace.applyEdit(edit);
            if (applied) {
                await settingsManager.incrementUsageStats('improve');
                const successMessage = settings.language === 'en'
                    ? 'Accessibility improvements applied successfully!'
                    : 'Erişilebilirlik iyileştirmeleri başarıyla uygulandı!';
                vscode.window.showInformationMessage(`♿ ${successMessage}`);
            }
        } else if (action === previewText) {
            // Show diff
            const originalUri = vscode.Uri.parse(`untitled:Original Code`);
            const improvedUri = vscode.Uri.parse(`untitled:Improved Code`);
            
            await vscode.workspace.openTextDocument(originalUri).then(doc => {
                return vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
            });
            
            await vscode.workspace.openTextDocument(improvedUri).then(doc => {
                return vscode.window.showTextDocument(doc, vscode.ViewColumn.Two);
            });
        }
        
    } catch (error) {
        console.error('Code improvement failed:', error);
        await aiServiceManager.handleServiceError(error, 'improveCurrentCode');
    }
}

async function showSetupWizard(context: vscode.ExtensionContext) {
    const wizardProvider = new WizardWebviewProvider(context.extensionUri, settingsManager);
    const settings = await settingsManager.getAccessibilitySettings();
    const isEnglish = settings.language === 'en';
    
    const panel = vscode.window.createWebviewPanel(
        'accessimind.wizard',
        isEnglish ? 'AccessiMind Setup Wizard' : 'AccessiMind Kurulum Sihirbazı',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            localResourceRoots: [context.extensionUri]
        }
    );

    await wizardProvider.resolveWebviewView(panel);
}

export function deactivate() {
    console.log('AccessiMind extension deactivated');
}