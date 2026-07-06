import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { getAiConfig, getAiModelsConfig, getNormalizedSelectedModel, normalizeAiSettingsSnapshot, updateNormalizedSelectedModel } from "./configurationUtils";
import { logger } from "./logger";
import { LocalizationManager } from "./localizationManager";

/**
 * AccessiMind JSON dosya yapısı için interface
 */
export interface AccessiMindSettings {
	version: string;
	createdAt: string;
	lastModified: string;
	wizard: {
		completed: boolean;
		completedAt?: string;
		steps: {
			provider: {
				completed: boolean;
				value?: string;
			};
			model: {
				completed: boolean;
				value?: string;
			};
			apiKey: {
				completed: boolean;
				hasValue: boolean; // API key'i kaydetmeyiz, sadece var olup olmadığını
			};
			wcagLevel: {
				completed: boolean;
				value?: string;
			};
			language: {
				completed: boolean;
				value?: string;
			};
			jiraConfig: {
				completed: boolean;
				config?: {
					customPrompt?: string;
					useCustomPrompt?: boolean;
					defaultPriority?: string;
					defaultComponent?: string;
					includeCodeExamples?: boolean;
					includeTestingSteps?: boolean;
				};
			};
			ollamaUrl: {
				completed: boolean;
				value?: string;
			};
		};
	};
	settings: {
		ai: {
			provider?: string;
			selectedModel?: string;
			apiKeyConfigured?: boolean; // Sadece varlık durumu
			autoTestOnChange?: boolean;
		};
		aiModels: {
			selectedModel?: string;
			availableModels?: string[];
		};
		language?: string;
		wcagLevel?: string;
		strictMode?: boolean;
		customRulesPath?: string;
		contextAwareAnalysis?: boolean;
		analysisDisabilityFocus?: string[];
		autoApply?: boolean;
		includeComments?: boolean;
		enableStatistics?: boolean;
		customPrompt?: string;
		responseDetail?: string;
		interfacePreferences?: {
			theme?: string;
			compactMode?: boolean;
			showAdvancedOptions?: boolean;
			showNotifications?: boolean;
			autoSave?: boolean;
		};
		browserIntegration?: {
			enabled?: boolean;
			browserPath?: string;
			launchMode?: string;
		};
		jira?: {
			customPrompt?: string;
			useCustomPrompt?: boolean;
			defaultPriority?: string;
			defaultComponent?: string;
			includeCodeExamples?: boolean;
			includeTestingSteps?: boolean;
		};
		shortcuts?: {
			analyzeOpenCode?: string;
			analyzeSelectedCode?: string;
			showInterface?: string;
		};
	};
	statistics: {
		enabled: boolean;
		sessionCount: number;
		totalAnalyses: number;
		totalImprovements: number;
		lastUsed?: string;
	};
	metadata: {
		extensionVersion?: string;
		vscodeVersion?: string;
		platform?: string;
		workspaceId?: string; // Workspace'e özgü ID
	};
}

/**
 * AccessiMind ayarlarını JSON dosyasında yöneten sınıf
 * VS Code açılıp kapandığında ayarların kalıcılığını sağlar
 */
export class AccessiMindJsonManager {
	private static instance: AccessiMindJsonManager;
	private context: vscode.ExtensionContext;
	private jsonFilePath: string;
	private settings: AccessiMindSettings | null = null;
	private isInitialized: boolean = false;
	private fileWatcher: vscode.FileSystemWatcher | undefined;
	private syncDebounceTimer: NodeJS.Timeout | undefined;
	private suppressWatcherReload = false;
	private lastSyncedSnapshot = "";

	private constructor(context: vscode.ExtensionContext) {
		this.context = context;
		// JSON dosyasını workspace root'a yerleştir
		const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ||
			path.dirname(context.extensionPath);
		this.jsonFilePath = path.join(workspaceRoot, "accessimind.json");
	}

	public static getInstance(context?: vscode.ExtensionContext): AccessiMindJsonManager {
		if (!AccessiMindJsonManager.instance && context) {
			AccessiMindJsonManager.instance = new AccessiMindJsonManager(context);
		}
		return AccessiMindJsonManager.instance;
	}

	/**
	 * JSON manager'ı başlat
	 */
	public async initialize(): Promise<void> {
		if (this.isInitialized) {
			return;
		}

		try {
			// JSON dosyasının varlığını kontrol et
			await this.checkJsonFileExists();

			// Settings'i yükle
			await this.loadSettings();

			// File watcher kurma
			this.setupFileWatcher();

			this.isInitialized = true;
			logger.info(`🔧 AccessiMindJsonManager başarıyla başlatıldı: ${this.jsonFilePath}`);
		} catch (error) {
			logger.error("❌ AccessiMindJsonManager başlatma hatası:", error);
			throw error;
		}
	}

	/**
	 * JSON dosyasının varlığını kontrol et, yoksa oluştur
	 */
	private async checkJsonFileExists(): Promise<void> {
		try {
			await fs.promises.access(this.jsonFilePath, fs.constants.F_OK);
			logger.info(`📁 AccessiMind JSON dosyası mevcut: ${this.jsonFilePath}`);
		} catch (error) {
			// Dosya yoksa default ayarlarla oluştur
			logger.info(`📁 AccessiMind JSON dosyası bulunamadı, oluşturuluyor: ${this.jsonFilePath}`);
			try {
				await this.createDefaultJsonFile();
			} catch (createError) {
				logger.error("❌ JSON dosyası oluşturulamadı:", createError);
				// Workspace dışında bir yerde oluşturmayı dene
				await this.createFallbackJsonFile();
			}
		}
	}

	/**
	 * Default JSON dosyasını oluştur
	 */
	private async createDefaultJsonFile(): Promise<void> {
		const defaultSettings: AccessiMindSettings = {
			version: "1.0.0",
			createdAt: new Date().toISOString(),
			lastModified: new Date().toISOString(),
			wizard: {
				completed: false,
				steps: {
					provider: { completed: false },
					model: { completed: false },
					apiKey: { completed: false, hasValue: false },
					wcagLevel: { completed: false },
					language: { completed: false },
					jiraConfig: { completed: false },
					ollamaUrl: { completed: false }
				}
			},
			settings: {
				ai: {
					apiKeyConfigured: false
				},
				aiModels: {},
				language: "auto",
				wcagLevel: "AA",
				strictMode: false,
				customRulesPath: "",
				contextAwareAnalysis: true,
				analysisDisabilityFocus: [],
				autoApply: false,
				includeComments: true,
				enableStatistics: true,
				responseDetail: "summary",
				interfacePreferences: {
					theme: "auto",
					compactMode: false,
					showAdvancedOptions: false
				},
				browserIntegration: {
					enabled: false,
					browserPath: "",
					launchMode: "new-isolated-window"
				},
				shortcuts: {
					analyzeOpenCode: "ctrl+alt+w",
					analyzeSelectedCode: "ctrl+alt+shift+w",
					showInterface: "ctrl+alt+u"
				}
			},
			statistics: {
				enabled: true,
				sessionCount: 0,
				totalAnalyses: 0,
				totalImprovements: 0
			},
			metadata: {
				extensionVersion: this.context.extension?.packageJSON?.version,
				vscodeVersion: vscode.version,
				platform: process.platform,
				workspaceId: vscode.workspace.workspaceFolders?.[0]?.uri.toString()
			}
		};

		await this.saveSettingsToFile(defaultSettings);
		this.settings = defaultSettings;
	}

	/**
	 * JSON dosyasından ayarları yükle
	 */
	public async loadSettings(): Promise<AccessiMindSettings> {
		try {
			const fileContent = await fs.promises.readFile(this.jsonFilePath, 'utf8');
			const parsedSettings = JSON.parse(fileContent) as AccessiMindSettings;

			// Version kontrolü ve migration
			await this.migrateSettingsIfNeeded(parsedSettings);

			this.settings = parsedSettings;
			logger.info("📥 AccessiMind ayarları JSON dosyasından başarıyla yüklendi");

			return this.settings;
		} catch (error) {
			logger.error("❌ JSON dosyasından ayar yükleme hatası:", error);

			// Hatalı dosya varsa backup al ve yeniden oluştur
			try {
				await this.handleCorruptedFile();
				return await this.loadSettings();
			} catch (recoveryError) {
				logger.error("❌ JSON dosyası kurtarma hatası:", recoveryError);
				// Son çare olarak default ayarlar döndür
				return await this.createInMemoryDefaults();
			}
		}
	}

	/**
	 * Ayarları JSON dosyasına kaydet
	 */
	public async saveSettings(newSettings: Partial<AccessiMindSettings>): Promise<void> {
		try {
			if (!this.settings) {
				await this.loadSettings();
			}

			// Mevcut ayarlarla merge et
			this.settings = this.mergeSettings(this.settings!, newSettings);
			this.settings.lastModified = new Date().toISOString();

			await this.saveSettingsToFile(this.settings);
			logger.info("💾 AccessiMind ayarları JSON dosyasına başarıyla kaydedildi");
		} catch (error) {
			logger.error("❌ JSON dosyasına ayar kaydetme hatası:", error);
			throw error;
		}
	}

	/**
	 * Wizard ayarlarını güncellle
	 */
	public async updateWizardSettings(wizardData: Partial<AccessiMindSettings['wizard']>): Promise<void> {
		const currentSettings = await this.getSettings();
		const updatedSettings: Partial<AccessiMindSettings> = {
			wizard: {
				...currentSettings.wizard,
				...wizardData
			}
		};

		if (wizardData.completed) {
			updatedSettings.wizard!.completedAt = new Date().toISOString();
		}

		await this.saveSettings(updatedSettings);
	}

	/**
	 * Wizard step'ini güncelle
	 */
	public async updateWizardStep(stepName: keyof AccessiMindSettings['wizard']['steps'], stepData: any): Promise<void> {
		const currentSettings = await this.getSettings();
		const updatedSettings: Partial<AccessiMindSettings> = {
			wizard: {
				...currentSettings.wizard,
				steps: {
					...currentSettings.wizard.steps,
					[stepName]: {
						...currentSettings.wizard.steps[stepName],
						...stepData,
						completed: true
					}
				}
			}
		};

		await this.saveSettings(updatedSettings);
	}

	/**
	 * VS Code configuration'dan ayarları senkronize et
	 */
	public async syncFromVSCodeConfiguration(): Promise<void> {
		try {
			const config = vscode.workspace.getConfiguration("wcagEnhancer");
			this.suppressWatcherReload = true;
			const { ai, aiModels, selectedModel } = normalizeAiSettingsSnapshot(config);

			const updatedSettings: Partial<AccessiMindSettings> = {
				settings: {
					ai: {
						provider: ai.provider,
						selectedModel,
						apiKeyConfigured: !!(typeof ai.apiKey === "string" && ai.apiKey.trim()),
						autoTestOnChange: !!ai.autoTestOnChange
					},
					aiModels: {
						selectedModel,
						availableModels: aiModels.availableModels
					},
					language: config.get("language"),
					wcagLevel: config.get("wcagLevel"),
					strictMode: config.get("strictMode"),
					customRulesPath: config.get("customRulesPath"),
					contextAwareAnalysis: config.get("contextAwareAnalysis"),
					analysisDisabilityFocus: config.get("analysisDisabilityFocus"),
					autoApply: config.get("autoApply"),
					includeComments: config.get("includeComments"),
					enableStatistics: config.get("enableStatistics"),
					customPrompt: config.get("customPrompt"),
					responseDetail: config.get("responseDetail"),
					interfacePreferences: config.get("interfacePreferences"),
					browserIntegration: config.get("browserIntegration"),
					jira: config.get("jira"),
					shortcuts: {
						analyzeOpenCode: config.get("shortcuts.analyzeOpenCode"),
						analyzeSelectedCode: config.get("shortcuts.analyzeSelectedCode"),
						showInterface: config.get("shortcuts.showInterface")
					}
				}
			};

			const snapshotKey = JSON.stringify(updatedSettings.settings);
			if (snapshotKey === this.lastSyncedSnapshot) {
				return;
			}

			await this.saveSettings(updatedSettings);
			this.lastSyncedSnapshot = snapshotKey;
			logger.info("🔄 VS Code configuration'dan JSON'a senkronizasyon tamamlandı");
		} catch (error) {
			logger.error("JSON sync from VS Code configuration failed", error);
		} finally {
			this.suppressWatcherReload = false;
		}
	}

	/**
	 * JSON'dan VS Code configuration'a ayarları uygula
	 */
	public scheduleSyncFromVSCodeConfiguration(delayMs = 300): void {
		if (this.syncDebounceTimer) {
			clearTimeout(this.syncDebounceTimer);
		}

		this.syncDebounceTimer = setTimeout(() => {
			void this.syncFromVSCodeConfiguration();
		}, delayMs);
	}

	public async applyToVSCodeConfiguration(): Promise<void> {
		try {
			const settings = await this.getSettings();
			const config = vscode.workspace.getConfiguration("wcagEnhancer");

			// Sadece değer olan ayarları uygula
			const updatePromises: Thenable<void>[] = [];

			if (settings.settings.ai?.provider) {
				const aiConfig = getAiConfig(config);
				aiConfig.provider = settings.settings.ai.provider;
				updatePromises.push(config.update("ai", aiConfig, vscode.ConfigurationTarget.Global));
			}

			if (settings.settings.aiModels?.selectedModel) {
				await updateNormalizedSelectedModel(config, settings.settings.aiModels.selectedModel);
			}

			if (settings.settings.language) {
				updatePromises.push(config.update("language", settings.settings.language, vscode.ConfigurationTarget.Global));
			}

			if (settings.settings.wcagLevel) {
				updatePromises.push(config.update("wcagLevel", settings.settings.wcagLevel, vscode.ConfigurationTarget.Global));
			}

			if (settings.settings.strictMode !== undefined) {
				updatePromises.push(config.update("strictMode", settings.settings.strictMode, vscode.ConfigurationTarget.Global));
			}

			if (settings.settings.customRulesPath !== undefined) {
				updatePromises.push(config.update("customRulesPath", settings.settings.customRulesPath, vscode.ConfigurationTarget.Global));
			}

			if (settings.settings.contextAwareAnalysis !== undefined) {
				updatePromises.push(config.update("contextAwareAnalysis", settings.settings.contextAwareAnalysis, vscode.ConfigurationTarget.Global));
			}

			if (settings.settings.analysisDisabilityFocus !== undefined) {
				updatePromises.push(config.update("analysisDisabilityFocus", settings.settings.analysisDisabilityFocus, vscode.ConfigurationTarget.Global));
			}

			if (settings.settings.autoApply !== undefined) {
				updatePromises.push(config.update("autoApply", settings.settings.autoApply, vscode.ConfigurationTarget.Global));
			}

			if (settings.settings.includeComments !== undefined) {
				updatePromises.push(config.update("includeComments", settings.settings.includeComments, vscode.ConfigurationTarget.Global));
			}

			if (settings.settings.enableStatistics !== undefined) {
				updatePromises.push(config.update("enableStatistics", settings.settings.enableStatistics, vscode.ConfigurationTarget.Global));
			}

			if (settings.settings.customPrompt) {
				updatePromises.push(config.update("customPrompt", settings.settings.customPrompt, vscode.ConfigurationTarget.Global));
			}

			if (settings.settings.responseDetail) {
				updatePromises.push(config.update("responseDetail", settings.settings.responseDetail, vscode.ConfigurationTarget.Global));
			}

			if (settings.settings.interfacePreferences) {
				updatePromises.push(config.update("interfacePreferences", settings.settings.interfacePreferences, vscode.ConfigurationTarget.Global));
			}

			if (settings.settings.browserIntegration) {
				updatePromises.push(config.update("browserIntegration", settings.settings.browserIntegration, vscode.ConfigurationTarget.Global));
			}

			if (settings.settings.jira) {
				updatePromises.push(config.update("jira", settings.settings.jira, vscode.ConfigurationTarget.Global));
			}

			if (settings.wizard.completed) {
				updatePromises.push(config.update("wizardCompleted", true, vscode.ConfigurationTarget.Global));
			}

			await Promise.all(updatePromises);

			logger.info("✅ JSON ayarları VS Code configuration'a başarıyla uygulandı");

			const localization = LocalizationManager.getInstance();
			vscode.window.showInformationMessage(localization.getString("json.settings.applied"));

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error("❌ JSON ayarlarını VS Code'a uygulama hatası:", error);
			const localization = LocalizationManager.getInstance();
			vscode.window.showErrorMessage(
				localization.getStringWithParams("json.settings.apply.error", { error: errorMessage })
			);
		} finally {
			this.suppressWatcherReload = false;
		}
	}

	/**
	 * Mevcut ayarları al
	 */
	public async getSettings(): Promise<AccessiMindSettings> {
		if (!this.settings) {
			await this.loadSettings();
		}
		return this.settings!;
	}

	/**
	 * JSON dosyasını izle
	 */
	private setupFileWatcher(): void {
		const filePattern = new vscode.RelativePattern(
			path.dirname(this.jsonFilePath),
			path.basename(this.jsonFilePath)
		);

		this.fileWatcher = vscode.workspace.createFileSystemWatcher(filePattern);

		this.fileWatcher.onDidChange(async () => {
			if (this.suppressWatcherReload) {
				return;
			}


			logger.info("🔄 AccessiMind JSON dosyası değişti, yeniden yükleniyor...");
			await this.loadSettings();
		});

		this.fileWatcher.onDidDelete(() => {
			logger.warn("⚠️ AccessiMind JSON dosyası silindi!");
			const localization = LocalizationManager.getInstance();
			vscode.window.showWarningMessage(localization.getString("json.file.deleted"));
		});
	}

	/**
	 * İstatistikleri güncelle
	 */
	public async updateStatistics(stats: Partial<AccessiMindSettings['statistics']>): Promise<void> {
		const currentSettings = await this.getSettings();
		const updatedSettings: Partial<AccessiMindSettings> = {
			statistics: {
				...currentSettings.statistics,
				...stats,
				lastUsed: new Date().toISOString()
			}
		};

		await this.saveSettings(updatedSettings);
	}

	/**
	 * Settings merge utility
	 */
	private mergeSettings(current: AccessiMindSettings, updates: Partial<AccessiMindSettings>): AccessiMindSettings {
		return {
			...current,
			...updates,
			wizard: updates.wizard ? { ...current.wizard, ...updates.wizard } : current.wizard,
			settings: updates.settings ? { ...current.settings, ...updates.settings } : current.settings,
			statistics: updates.statistics ? { ...current.statistics, ...updates.statistics } : current.statistics,
			metadata: updates.metadata ? { ...current.metadata, ...updates.metadata } : current.metadata
		};
	}

	/**
	 * Ayarları dosyaya kaydet
	 */
	private async saveSettingsToFile(settings: AccessiMindSettings): Promise<void> {
		const jsonContent = JSON.stringify(settings, null, 2);
		await fs.promises.writeFile(this.jsonFilePath, jsonContent, 'utf8');
	}

	/**
	 * Version migration
	 */
	private async migrateSettingsIfNeeded(settings: AccessiMindSettings): Promise<void> {
		// Gelecekte version migration gerektiğinde buraya eklenecek
		if (!settings.version || settings.version !== "1.0.0") {
			logger.info("🔄 AccessiMind settings migration işlemi başlatılıyor...");
			settings.version = "1.0.0";
			settings.lastModified = new Date().toISOString();
			await this.saveSettingsToFile(settings);
		}
	}

	/**
	 * Bozuk dosyayı handle et
	 */
	private async handleCorruptedFile(): Promise<void> {
		try {
			// Backup oluştur
			const backupPath = this.jsonFilePath + `.backup.${Date.now()}`;
			await fs.promises.copyFile(this.jsonFilePath, backupPath);
			logger.info(`📁 Bozuk JSON dosyası yedeklendi: ${backupPath}`);

			// Yeni dosya oluştur
			await this.createDefaultJsonFile();

			const localization = LocalizationManager.getInstance();
			vscode.window.showWarningMessage(
				localization.getStringWithParams("json.file.corrupted", { path: backupPath })
			);
		} catch (error) {
			logger.error("❌ Bozuk dosya backup hatası:", error);
			throw error;
		}
	}

	/**
	 * JSON dosya yolunu al
	 */

	/**
	 * Fallback JSON dosyası oluştur (workspace dışında)
	 */
	private async createFallbackJsonFile(): Promise<void> {
		try {
			// Extension path'inde bir fallback oluştur
			const fallbackPath = path.join(this.context.globalStorageUri?.fsPath || this.context.extensionPath, "accessimind-fallback.json");

			// Directory oluştur
			const fallbackDir = path.dirname(fallbackPath);
			await fs.promises.mkdir(fallbackDir, { recursive: true });

			// Fallback JSON path'ini güncelle
			this.jsonFilePath = fallbackPath;

			// Default dosyayı oluştur
			await this.createDefaultJsonFile();

			logger.warn(`⚠️ Workspace'de JSON oluşturulamadı, fallback konumu kullanılıyor: ${fallbackPath}`);
			const localization = LocalizationManager.getInstance();
			vscode.window.showWarningMessage(
				localization.getStringWithParams("json.file.fallback", { path: fallbackPath })
			);
		} catch (error) {
			logger.error("❌ Fallback JSON dosyası da oluşturulamadı:", error);
			throw new Error("JSON dosyası oluşturulamadı. Yazma izinlerini kontrol edin.");
		}
	}

	/**
	 * In-memory default settings oluştur (son çare)
	 */
	private async createInMemoryDefaults(): Promise<AccessiMindSettings> {
		logger.warn("⚠️ JSON dosyası okunamadı, in-memory defaults kullanılıyor");

		const defaults: AccessiMindSettings = {
			version: "1.0.0",
			createdAt: new Date().toISOString(),
			lastModified: new Date().toISOString(),
			wizard: {
				completed: false,
				steps: {
					provider: { completed: false },
					model: { completed: false },
					apiKey: { completed: false, hasValue: false },
					wcagLevel: { completed: false },
					language: { completed: false },
					jiraConfig: { completed: false },
					ollamaUrl: { completed: false }
				}
			},
			settings: {
				ai: { apiKeyConfigured: false },
				aiModels: {},
				language: "auto",
				wcagLevel: "AA",
				autoApply: false,
				includeComments: true,
				enableStatistics: true,
				responseDetail: "summary",
				interfacePreferences: {
					theme: "auto",
					compactMode: false,
					showAdvancedOptions: false
				},
				browserIntegration: {
					enabled: false,
					browserPath: "",
					launchMode: "new-isolated-window"
				},
				shortcuts: {
					analyzeOpenCode: "ctrl+alt+w",
					analyzeSelectedCode: "ctrl+alt+shift+w",
					showInterface: "ctrl+alt+u"
				}
			},
			statistics: {
				enabled: true,
				sessionCount: 0,
				totalAnalyses: 0,
				totalImprovements: 0
			},
			metadata: {
				extensionVersion: this.context.extension?.packageJSON?.version,
				vscodeVersion: vscode.version,
				platform: process.platform,
				workspaceId: "in-memory-fallback"
			}
		};

		this.settings = defaults;

		const localization = LocalizationManager.getInstance();
		vscode.window.showWarningMessage(localization.getString("json.file.read.error"));

		return defaults;
	}

	/**
	 * JSON dosya yolunu güvenli şekilde al
	 */
	public getJsonFilePath(): string {
		return this.jsonFilePath;
	}

	/**
	 * JSON dosyasının sağlığını kontrol et
	 */
	public async validateJsonHealth(): Promise<{ isHealthy: boolean; issues: string[] }> {
		const issues: string[] = [];

		try {
			// Dosya varlığını kontrol et
			await fs.promises.access(this.jsonFilePath, fs.constants.F_OK);
		} catch (error) {
			issues.push("Dosya bulunamadı");
			return { isHealthy: false, issues };
		}

		try {
			// Dosya okunabilirliğini kontrol et
			await fs.promises.access(this.jsonFilePath, fs.constants.R_OK);
		} catch (error) {
			issues.push("Dosya okunamıyor (izin sorunu)");
		}

		try {
			// Dosya yazılabilirliğini kontrol et
			await fs.promises.access(this.jsonFilePath, fs.constants.W_OK);
		} catch (error) {
			issues.push("Dosyaya yazılamıyor (izin sorunu)");
		}

		try {
			// JSON parse edilebilirliğini kontrol et
			const content = await fs.promises.readFile(this.jsonFilePath, 'utf8');
			JSON.parse(content);
		} catch (error) {
			issues.push("JSON formatı geçersiz");
		}

		return {
			isHealthy: issues.length === 0,
			issues
		};
	}

	/**
	 * JSON dosyasını onar
	 */
	public async repairJsonFile(): Promise<void> {
		try {
			const health = await this.validateJsonHealth();

			if (health.isHealthy) {
				logger.info("✅ JSON dosyası sağlıklı, onarım gerekmiyor");
				return;
			}

			logger.warn("🔧 JSON dosyası onarılıyor...", health.issues);

			// Backup oluştur
			try {
				const backupPath = this.jsonFilePath + `.repair-backup.${Date.now()}`;
				await fs.promises.copyFile(this.jsonFilePath, backupPath);
				logger.info(`📁 Onarım öncesi backup oluşturuldu: ${backupPath}`);
			} catch (backupError) {
				logger.warn("⚠️ Backup oluşturulamadı:", backupError);
			}

			// Yeni dosya oluştur
			await this.createDefaultJsonFile();

			const localization = LocalizationManager.getInstance();
			vscode.window.showInformationMessage(localization.getString("json.file.repaired"));

		} catch (error) {
			logger.error("❌ JSON dosyası onarılamadı:", error);
			throw error;
		}
	}

	/**
	 * Resource'ları temizle
	 */
	public dispose(): void {
		if (this.fileWatcher) {
			this.fileWatcher.dispose();
		}
		logger.info("🔄 AccessiMindJsonManager temizlendi");
	}
}



