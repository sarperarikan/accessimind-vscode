// Minimal VS Code UI Toolkit fallback
// This is a simplified version for webview compatibility

window.customElements = window.customElements || {};

// Define basic VS Code button component
if (!customElements.get('vscode-button')) {
    class VscodeButton extends HTMLElement {
        constructor() {
            super();
            this.innerHTML = `
                <style>
                    :host {
                        display: inline-block;
                        color: var(--vscode-button-foreground);
                        background: var(--vscode-button-background);
                        border: none;
                        border-radius: 2px;
                        padding: 4px 14px;
                        font-family: var(--vscode-font-family);
                        font-size: 13px;
                        cursor: pointer;
                        outline: none;
                        transition: background-color 0.2s;
                    }
                    :host([appearance="secondary"]) {
                        background: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                    }
                    :host([appearance="icon"]) {
                        background: transparent;
                        border: 1px solid transparent;
                        padding: 4px;
                    }
                    :host(:hover) {
                        background: var(--vscode-button-hoverBackground);
                    }
                    :host([appearance="secondary"]:hover) {
                        background: var(--vscode-button-secondaryHoverBackground);
                    }
                    :host([disabled]) {
                        opacity: 0.4;
                        cursor: not-allowed;
                    }
                </style>
                <slot></slot>
            `;
        }
    }
    customElements.define('vscode-button', VscodeButton);
}

// Define basic VS Code dropdown component
if (!customElements.get('vscode-dropdown')) {
    class VscodeDropdown extends HTMLElement {
        constructor() {
            super();
            this.innerHTML = `
                <style>
                    :host {
                        display: inline-block;
                        position: relative;
                    }
                    select {
                        appearance: none;
                        background: var(--vscode-dropdown-background);
                        color: var(--vscode-dropdown-foreground);
                        border: 1px solid var(--vscode-dropdown-border);
                        border-radius: 2px;
                        padding: 4px 20px 4px 8px;
                        font-family: var(--vscode-font-family);
                        font-size: 13px;
                        cursor: pointer;
                        outline: none;
                        min-width: 80px;
                    }
                    select:focus {
                        border-color: var(--vscode-focusBorder);
                    }
                    .arrow {
                        position: absolute;
                        right: 6px;
                        top: 50%;
                        transform: translateY(-50%);
                        pointer-events: none;
                        color: var(--vscode-dropdown-foreground);
                    }
                </style>
                <select></select>
                <span class="arrow">▼</span>
            `;
            
            this.select = this.querySelector('select');
            this.updateOptions();
        }
        
        updateOptions() {
            const options = this.querySelectorAll('vscode-option');
            this.select.innerHTML = '';
            options.forEach(option => {
                const optionEl = document.createElement('option');
                optionEl.value = option.getAttribute('value') || option.textContent;
                optionEl.textContent = option.textContent;
                this.select.appendChild(optionEl);
            });
        }
        
        get value() {
            return this.select.value;
        }
        
        set value(val) {
            this.select.value = val;
        }
    }
    customElements.define('vscode-dropdown', VscodeDropdown);
}

// Define basic VS Code option component
if (!customElements.get('vscode-option')) {
    class VscodeOption extends HTMLElement {
        constructor() {
            super();
            this.style.display = 'none';
        }
    }
    customElements.define('vscode-option', VscodeOption);
}

// Define basic VS Code textarea component
if (!customElements.get('vscode-text-area')) {
    class VscodeTextArea extends HTMLElement {
        constructor() {
            super();
            this.innerHTML = `
                <style>
                    :host {
                        display: block;
                    }
                    textarea {
                        width: 100%;
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 2px;
                        padding: 4px 8px;
                        font-family: var(--vscode-font-family);
                        font-size: 13px;
                        resize: vertical;
                        outline: none;
                    }
                    textarea:focus {
                        border-color: var(--vscode-focusBorder);
                    }
                    textarea::placeholder {
                        color: var(--vscode-input-placeholderForeground);
                    }
                </style>
                <textarea></textarea>
            `;
            
            this.textarea = this.querySelector('textarea');
            
            // Forward properties
            ['placeholder', 'rows', 'cols', 'disabled', 'readonly'].forEach(prop => {
                if (this.hasAttribute(prop)) {
                    this.textarea[prop] = this.getAttribute(prop);
                }
            });
        }
        
        get value() {
            return this.textarea.value;
        }
        
        set value(val) {
            this.textarea.value = val;
        }
    }
    customElements.define('vscode-text-area', VscodeTextArea);
}

console.log('VS Code UI Toolkit fallback loaded');