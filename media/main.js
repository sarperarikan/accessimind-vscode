// Main JavaScript for AccessiMind Webview
(function() {
	'use strict';

	// Get VS Code API
	const vscode = acquireVsCodeApi();

	// DOM elements
	const chatInput = document.getElementById('chat-input');
	const sendBtn = document.getElementById('send-btn');
	const chatMessages = document.getElementById('chat-messages');
	const typingIndicator = document.getElementById('typing-indicator');
	const tabs = document.querySelectorAll('.tab');
	const tabContents = document.querySelectorAll('.tab-content');

	// Tab switching
	tabs.forEach(tab => {
		tab.addEventListener('click', () => {
			const targetId = tab.getAttribute('aria-controls');
			
			// Update tab states
			tabs.forEach(t => {
				t.classList.remove('active');
				t.setAttribute('aria-selected', 'false');
			});
			tab.classList.add('active');
			tab.setAttribute('aria-selected', 'true');
			
			// Update content visibility
			tabContents.forEach(content => {
				content.classList.remove('active');
			});
			document.getElementById(targetId).classList.add('active');
			
			// Load stats when stats tab is activated
			if (targetId === 'stats-panel') {
				refreshStats();
			}
		});
	});

	// Chat functionality
	function sendMessage(event) {
		event.preventDefault();
		
		const message = chatInput.value.trim();
		if (!message) return;
		
		// Add user message to chat
		addChatMessage(message, true);
		
		// Clear input
		chatInput.value = '';
		
		// Send message to extension
		vscode.postMessage({
			type: 'chat',
			message: message
		});
	}

	function addChatMessage(message, isUser = false, isError = false) {
		const messageDiv = document.createElement('div');
		messageDiv.className = `message ${isUser ? 'user' : 'assistant'}${isError ? ' error' : ''}`;
		messageDiv.textContent = message;
		
		chatMessages.appendChild(messageDiv);
		chatMessages.scrollTop = chatMessages.scrollHeight;
	}

	// Quick action buttons
	window.improveFile = function() {
		vscode.postMessage({
			type: 'improveFile'
		});
	};

	window.improveSelection = function() {
		vscode.postMessage({
			type: 'improveSelection'
		});
	};

	// Stats functionality
	window.refreshStats = function() {
		vscode.postMessage({
			type: 'getStats'
		});
	};

	window.resetStats = function() {
		if (confirm('Are you sure you want to reset statistics?')) {
			vscode.postMessage({
				type: 'resetStats'
			});
		}
	};

	// Settings functionality
	window.setApiKey = function() {
		const apiKey = document.getElementById('api-key').value;
		if (apiKey) {
			// Save to localStorage for persistence
			saveSettings({ apiKey: apiKey });
			
			vscode.postMessage({
				type: 'setApiKey',
				apiKey: apiKey
			});
		}
	};

	// Persistent settings management
	function saveSettings(settings) {
		try {
			const currentSettings = loadSettings();
			const updatedSettings = { ...currentSettings, ...settings };
			localStorage.setItem('wcag-enhancer-settings', JSON.stringify(updatedSettings));
			
			// Notify extension about settings change
			vscode.postMessage({
				type: 'settingsChanged',
				settings: updatedSettings
			});
		} catch (error) {
			console.error('Failed to save settings:', error);
		}
	}

	function loadSettings() {
		try {
			const saved = localStorage.getItem('wcag-enhancer-settings');
			return saved ? JSON.parse(saved) : {};
		} catch (error) {
			console.error('Failed to load settings:', error);
			return {};
		}
	}

	function initializeSettings() {
		const settings = loadSettings();
		
		// Apply saved API key
		if (settings.apiKey) {
			const apiKeyInput = document.getElementById('api-key');
			if (apiKeyInput) {
				apiKeyInput.value = settings.apiKey;
			}
		}

		// Apply other wizard settings
		if (settings.wizardSettings) {
			applyWizardSettings(settings.wizardSettings);
		}

		// Notify extension about loaded settings
		vscode.postMessage({
			type: 'settingsLoaded',
			settings: settings
		});
	}

	function applyWizardSettings(wizardSettings) {
		// Apply language preference
		if (wizardSettings.language) {
			const langSelect = document.getElementById('language-select');
			if (langSelect) {
				langSelect.value = wizardSettings.language;
			}
		}

		// Apply accessibility level
		if (wizardSettings.accessibilityLevel) {
			const levelSelect = document.getElementById('accessibility-level');
			if (levelSelect) {
				levelSelect.value = wizardSettings.accessibilityLevel;
			}
		}

		// Apply enhancement mode
		if (wizardSettings.enhancementMode) {
			const modeSelect = document.getElementById('enhancement-mode');
			if (modeSelect) {
				modeSelect.value = wizardSettings.enhancementMode;
			}
		}

		// Apply auto-save preference
		if (typeof wizardSettings.autoSave === 'boolean') {
			const autoSaveCheckbox = document.getElementById('auto-save');
			if (autoSaveCheckbox) {
				autoSaveCheckbox.checked = wizardSettings.autoSave;
			}
		}
	}

	// Wizard settings functions
	window.saveWizardSettings = function() {
		const wizardSettings = {
			language: document.getElementById('language-select')?.value || 'en',
			accessibilityLevel: document.getElementById('accessibility-level')?.value || 'AA',
			enhancementMode: document.getElementById('enhancement-mode')?.value || 'standard',
			autoSave: document.getElementById('auto-save')?.checked || false,
			completedAt: new Date().toISOString()
		};

		saveSettings({ wizardSettings: wizardSettings });
	};

	window.resetAllSettings = function() {
		if (confirm('Are you sure you want to reset all settings? This will clear the wizard configuration and API key.')) {
			try {
				localStorage.removeItem('wcag-enhancer-settings');
				
				// Clear form inputs
				const apiKeyInput = document.getElementById('api-key');
				if (apiKeyInput) apiKeyInput.value = '';
				
				// Reset wizard to defaults
				const langSelect = document.getElementById('language-select');
				if (langSelect) langSelect.value = 'en';
				
				const levelSelect = document.getElementById('accessibility-level');
				if (levelSelect) levelSelect.value = 'AA';
				
				const modeSelect = document.getElementById('enhancement-mode');
				if (modeSelect) modeSelect.value = 'standard';
				
				const autoSaveCheckbox = document.getElementById('auto-save');
				if (autoSaveCheckbox) autoSaveCheckbox.checked = false;

				// Notify extension
				vscode.postMessage({
					type: 'settingsReset'
				});
			} catch (error) {
				console.error('Failed to reset settings:', error);
			}
		}
	};

	window.testApiKey = function() {
		vscode.postMessage({
			type: 'testApiKey'
		});
	};

	window.showTroubleshooting = function() {
		vscode.postMessage({
			type: 'showTroubleshooting'
		});
	};

	window.diagnoseApi = function() {
		vscode.postMessage({
			type: 'diagnoseApi'
		});
	};

	// Handle messages from extension
	window.addEventListener('message', event => {
		const message = event.data;
		
		switch (message.type) {
			case 'addChatMessage':
				addChatMessage(message.message, message.isUser, message.isError);
				break;
				
			case 'setTyping':
				if (message.isTyping) {
					typingIndicator.classList.add('show');
				} else {
					typingIndicator.classList.remove('show');
				}
				break;
				
			case 'updateStats':
				updateStatsDisplay(message.stats);
				break;
				
			case 'loadWizardSettings':
				// Load settings when wizard is opened
				const settings = loadSettings();
				if (settings.wizardSettings) {
					applyWizardSettings(settings.wizardSettings);
				}
				break;
				
			case 'resetWizard':
				// Reset wizard to defaults
				const defaultSettings = {
					language: 'en',
					accessibilityLevel: 'AA',
					enhancementMode: 'standard',
					autoSave: false
				};
				applyWizardSettings(defaultSettings);
				break;
		}
	});

	// Update stats display
	function updateStatsDisplay(stats) {
		// Update main stats
		document.getElementById('total-improvements').textContent = stats.totalEnhancements || 0;
		document.getElementById('success-rate').textContent = `${Math.round((stats.successRate || 0) * 100)}%`;
		document.getElementById('total-lines').textContent = stats.totalLinesImproved || 0;
		document.getElementById('chat-messages-count').textContent = stats.chatMessages || 0;
		
		// Update language chart
		updateLanguageChart(stats.languageStats || {});
		
		// Update type chart
		updateTypeChart(stats.typeStats || {});
	}

	function updateLanguageChart(languageStats) {
		const chartContainer = document.getElementById('language-chart');
		chartContainer.innerHTML = '';
		
		const total = Object.values(languageStats).reduce((sum, count) => sum + count, 0);
		
		Object.entries(languageStats).forEach(([language, count]) => {
			const percentage = total > 0 ? (count / total) * 100 : 0;
			
			const barDiv = document.createElement('div');
			barDiv.className = 'chart-bar';
			barDiv.innerHTML = `
				<div class="chart-label">${language}</div>
				<div class="chart-progress">
					<div class="chart-fill" style="width: ${percentage}%"></div>
				</div>
				<div class="chart-value">${count}</div>
			`;
			
			chartContainer.appendChild(barDiv);
		});
	}

	function updateTypeChart(typeStats) {
		const chartContainer = document.getElementById('type-chart');
		chartContainer.innerHTML = '';
		
		const total = Object.values(typeStats).reduce((sum, count) => sum + count, 0);
		
		Object.entries(typeStats).forEach(([type, count]) => {
			const percentage = total > 0 ? (count / total) * 100 : 0;
			
			const barDiv = document.createElement('div');
			barDiv.className = 'chart-bar';
			barDiv.innerHTML = `
				<div class="chart-label">${getTypeLabel(type)}</div>
				<div class="chart-progress">
					<div class="chart-fill" style="width: ${percentage}%"></div>
				</div>
				<div class="chart-value">${count}</div>
			`;
			
			chartContainer.appendChild(barDiv);
		});
	}

	function getTypeLabel(type) {
		const labels = {
			'file': 'File Enhancement',
			'selection': 'Selection Enhancement',
			'chat': 'Chat',
			'debug': 'Debug',
			'agent': 'Agent',
			'edit': 'Edit'
		};
		return labels[type] || type;
	}

	// Keyboard navigation
	document.addEventListener('keydown', event => {
		// Tab navigation
		if (event.key === 'Tab') {
			// Handle tab navigation for accessibility
		}
		
		// Enter to send message
		if (event.key === 'Enter' && event.target === chatInput) {
			sendMessage(event);
		}
		
		// Escape to clear input
		if (event.key === 'Escape' && event.target === chatInput) {
			chatInput.value = '';
			chatInput.blur();
		}
	});

	// Focus management
	chatInput.addEventListener('focus', () => {
		chatInput.setAttribute('aria-describedby', 'input-help');
	});

	chatInput.addEventListener('blur', () => {
		chatInput.removeAttribute('aria-describedby');
	});

	// Initialize
	document.addEventListener('DOMContentLoaded', () => {
		// Load persistent settings first
		initializeSettings();
		
		// Set initial focus
		chatInput.focus();
		
		// Load initial stats
		refreshStats();
	});

})(); 