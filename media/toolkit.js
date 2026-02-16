// Minimal VS Code UI Toolkit fallback
// This is a simplified version for webview compatibility

// Define basic VS Code button component
if (!customElements.get('vscode-button')) {
    class VscodeButton extends HTMLElement {
        constructor() {
            super();
            const shadow = this.attachShadow({ mode: 'open' });
            shadow.innerHTML = `
                <style>
                    :host {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        color: var(--vscode-button-foreground);
                        background: var(--vscode-button-background);
                        border: none;
                        border-radius: 2px;
                        padding: 6px 14px;
                        font-family: var(--vscode-font-family);
                        font-size: 13px;
                        cursor: pointer;
                        outline: none;
                        transition: background-color 0.2s;
                        min-height: 28px;
                        box-sizing: border-box;
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
            const shadow = this.attachShadow({ mode: 'open' });
            shadow.innerHTML = `
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

            this._select = shadow.querySelector('select');
        }

        connectedCallback() {
            this._updateOptions();
        }

        _updateOptions() {
            const options = this.querySelectorAll('vscode-option');
            this._select.innerHTML = '';
            options.forEach(option => {
                const optionEl = document.createElement('option');
                optionEl.value = option.getAttribute('value') || option.textContent;
                optionEl.textContent = option.textContent;
                this._select.appendChild(optionEl);
            });
        }

        get value() {
            return this._select.value;
        }

        set value(val) {
            this._select.value = val;
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
            const shadow = this.attachShadow({ mode: 'open' });
            shadow.innerHTML = `
                <style>
                    :host {
                        display: block;
                    }
                    textarea {
                        width: 100%;
                        box-sizing: border-box;
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border, var(--vscode-widget-border));
                        border-radius: 2px;
                        padding: 6px 8px;
                        font-family: var(--vscode-font-family);
                        font-size: 13px;
                        resize: vertical;
                        outline: none;
                        line-height: 1.4;
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

            this._textarea = shadow.querySelector('textarea');

            // Forward keydown events
            this._textarea.addEventListener('keydown', (e) => {
                this.dispatchEvent(new KeyboardEvent('keydown', {
                    key: e.key,
                    code: e.code,
                    shiftKey: e.shiftKey,
                    ctrlKey: e.ctrlKey,
                    altKey: e.altKey,
                    metaKey: e.metaKey,
                    bubbles: true,
                    cancelable: true
                }));
            });
        }

        connectedCallback() {
            // Forward properties
            ['placeholder', 'rows', 'cols', 'disabled', 'readonly'].forEach(prop => {
                if (this.hasAttribute(prop)) {
                    this._textarea[prop] = this.getAttribute(prop);
                }
            });
        }

        get value() {
            return this._textarea ? this._textarea.value : '';
        }

        set value(val) {
            if (this._textarea) {
                this._textarea.value = val;
            }
        }

        focus() {
            if (this._textarea) {
                this._textarea.focus();
            }
        }

        blur() {
            if (this._textarea) {
                this._textarea.blur();
            }
        }
    }
    customElements.define('vscode-text-area', VscodeTextArea);
}

console.log('VS Code UI Toolkit fallback loaded');