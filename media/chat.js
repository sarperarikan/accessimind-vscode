(function () {
    const vscode = acquireVsCodeApi();

    // DOM Elements
    const messagesContainer = document.getElementById('messages');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const closeBtn = document.getElementById('close-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const historyBtn = document.getElementById('history-btn');
    const historyPanel = document.getElementById('history-panel');
    const closeHistoryBtn = document.getElementById('close-history-btn');
    const historyList = document.getElementById('history-list');
    const activeFileName = document.getElementById('active-file-name');

    // State
    let currentMessages = [];
    let chatHistory = [];

    // Focus input on load
    if (chatInput) {
        chatInput.focus();
    }

    // Header Button Event Listeners
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'closeChat' });
        });
    }

    if (newChatBtn) {
        newChatBtn.addEventListener('click', () => {
            // Save current chat to history if it has messages
            if (currentMessages.length > 1) {
                saveChatToHistory();
            }
            vscode.postMessage({ type: 'newChat' });
            currentMessages = [];
        });
    }

    if (historyBtn) {
        historyBtn.addEventListener('click', () => {
            toggleHistoryPanel();
        });
    }

    if (closeHistoryBtn) {
        closeHistoryBtn.addEventListener('click', () => {
            toggleHistoryPanel(false);
        });
    }

    function toggleHistoryPanel(show) {
        if (historyPanel) {
            const isVisible = historyPanel.classList.contains('visible');
            if (show === undefined) {
                show = !isVisible;
            }
            historyPanel.classList.toggle('visible', show);
            historyPanel.setAttribute('aria-hidden', !show);
            if (show) {
                vscode.postMessage({ type: 'loadHistory' });
            }
        }
    }

    function saveChatToHistory() {
        const chatData = {
            id: Date.now(),
            title: getFirstUserMessage() || 'New Chat',
            date: new Date().toLocaleDateString(),
            messages: currentMessages
        };
        chatHistory.unshift(chatData);
        // Limit history to 20 items
        if (chatHistory.length > 20) {
            chatHistory.pop();
        }
        vscode.postMessage({ type: 'saveHistory', messages: currentMessages });
    }

    function getFirstUserMessage() {
        const userMsg = currentMessages.find(m => m.role === 'user');
        if (userMsg) {
            return userMsg.text.substring(0, 30) + (userMsg.text.length > 30 ? '...' : '');
        }
        return null;
    }

    function renderHistory() {
        if (!historyList) return;

        if (chatHistory.length === 0) {
            historyList.innerHTML = '<div class="history-empty">No saved chats yet</div>';
            return;
        }

        historyList.innerHTML = chatHistory.map(chat => `
            <div class="history-item" data-id="${chat.id}">
                <div class="title">${escapeHtml(chat.title)}</div>
                <div class="date">${chat.date}</div>
            </div>
        `).join('');

        // Add click handlers
        historyList.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
                const chatId = parseInt(item.dataset.id);
                loadChatFromHistory(chatId);
            });
        });
    }

    function loadChatFromHistory(chatId) {
        const chat = chatHistory.find(c => c.id === chatId);
        if (chat) {
            clearMessages();
            chat.messages.forEach(msg => {
                addMessage(msg.role, msg.text, false);
            });
            currentMessages = [...chat.messages];
            toggleHistoryPanel(false);
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Simple markdown parser
    function parseMarkdown(text) {
        if (!text) return '';

        let html = text
            // Escape HTML first
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            // Code blocks (``` ... ```)
            .replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
                return `<pre class="code-block" data-lang="${lang}"><code>${code.trim()}</code></pre>`;
            })
            // Inline code (` ... `)
            .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
            // Bold (**text** or __text__)
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/__([^_]+)__/g, '<strong>$1</strong>')
            // Italic (*text* or _text_)
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            .replace(/_([^_]+)_/g, '<em>$1</em>')
            // Headers
            .replace(/^### (.+)$/gm, '<h4>$1</h4>')
            .replace(/^## (.+)$/gm, '<h3>$1</h3>')
            .replace(/^# (.+)$/gm, '<h2>$1</h2>')
            // Unordered lists
            .replace(/^\s*[-*] (.+)$/gm, '<li>$1</li>')
            // Ordered lists
            .replace(/^\s*\d+\. (.+)$/gm, '<li>$1</li>')
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="md-link">$1</a>')
            // Line breaks
            .replace(/\n/g, '<br>');

        // Wrap consecutive <li> in <ul>
        html = html.replace(/(<li>.*?<\/li>)(<br>)?/g, '$1');
        html = html.replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>');

        return html;
    }

    // Generate unique ID for messages
    let messageCounter = 0;
    function generateMessageId() {
        return `msg-${Date.now()}-${messageCounter++}`;
    }

    function addMessage(role, text, track = true) {
        const messageId = generateMessageId();
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        messageDiv.id = messageId;
        messageDiv.setAttribute('role', 'article');
        messageDiv.setAttribute('aria-label', `${role === 'user' ? 'You' : 'AI Assistant'} message`);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'content';

        // Use markdown for agent messages, plain text for user
        if (role === 'agent' || role === 'assistant') {
            contentDiv.innerHTML = parseMarkdown(text);
        } else {
            contentDiv.textContent = text;
        }

        messageDiv.appendChild(contentDiv);

        // Add action buttons for agent messages
        if (role === 'agent' || role === 'assistant') {
            const actionsDiv = createActionButtons(messageId, text);
            messageDiv.appendChild(actionsDiv);
        }

        messagesContainer.appendChild(messageDiv);

        // Track message for history
        if (track && role !== 'system') {
            currentMessages.push({ id: messageId, role, text });
        }

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function clearMessages() {
        // Keep only the welcome message
        const welcomeMessage = messagesContainer.querySelector('.message.system');
        messagesContainer.innerHTML = '';
        if (welcomeMessage) {
            messagesContainer.appendChild(welcomeMessage);
        }
    }

    function createActionButtons(messageId, text) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';
        actionsDiv.setAttribute('role', 'toolbar');
        actionsDiv.setAttribute('aria-label', 'Message actions');

        // Copy button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'action-btn';
        copyBtn.innerHTML = '📋 Copy';
        copyBtn.setAttribute('aria-label', 'Copy message to clipboard');
        copyBtn.setAttribute('title', 'Copy to clipboard');
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(text).then(() => {
                copyBtn.innerHTML = '✅ Copied!';
                setTimeout(() => { copyBtn.innerHTML = '📋 Copy'; }, 2000);
            });
        });
        actionsDiv.appendChild(copyBtn);

        // Insert to Editor button
        const insertBtn = document.createElement('button');
        insertBtn.className = 'action-btn';
        insertBtn.innerHTML = '📝 Insert';
        insertBtn.setAttribute('aria-label', 'Insert message into active editor');
        insertBtn.setAttribute('title', 'Insert to Editor');
        insertBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'insertToEditor', text: text });
            insertBtn.innerHTML = '✅ Inserted!';
            setTimeout(() => { insertBtn.innerHTML = '📝 Insert'; }, 2000);
        });
        actionsDiv.appendChild(insertBtn);

        // Copy Code button (if message contains code)
        if (text.includes('```')) {
            const copyCodeBtn = document.createElement('button');
            copyCodeBtn.className = 'action-btn';
            copyCodeBtn.innerHTML = '💻 Copy Code';
            copyCodeBtn.setAttribute('aria-label', 'Copy code blocks only');
            copyCodeBtn.setAttribute('title', 'Copy Code Blocks');
            copyCodeBtn.addEventListener('click', () => {
                const codeBlocks = text.match(/```[\w]*\n?([\s\S]*?)```/g);
                if (codeBlocks) {
                    const code = codeBlocks.map(block =>
                        block.replace(/```[\w]*\n?/, '').replace(/```$/, '').trim()
                    ).join('\n\n');
                    navigator.clipboard.writeText(code).then(() => {
                        copyCodeBtn.innerHTML = '✅ Copied!';
                        setTimeout(() => { copyCodeBtn.innerHTML = '💻 Copy Code'; }, 2000);
                    });
                }
            });
            actionsDiv.appendChild(copyCodeBtn);
        }

        // Share button
        const shareBtn = document.createElement('button');
        shareBtn.className = 'action-btn';
        shareBtn.innerHTML = '🔗 Share';
        shareBtn.setAttribute('aria-label', 'Share message');
        shareBtn.setAttribute('title', 'Share');
        shareBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'shareMessage', text: text, messageId: messageId });
        });
        actionsDiv.appendChild(shareBtn);

        return actionsDiv;
    }

    function setLoading(isLoading) {
        if (isLoading) {
            const loadingDiv = document.createElement('div');
            loadingDiv.id = 'loading-indicator';
            loadingDiv.className = 'message agent loading';
            loadingDiv.innerHTML = '<span class="loading-dots">Thinking<span>.</span><span>.</span><span>.</span></span>';
            loadingDiv.setAttribute('aria-live', 'polite');
            loadingDiv.setAttribute('aria-label', 'AI is thinking');
            messagesContainer.appendChild(loadingDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } else {
            const loadingDiv = document.getElementById('loading-indicator');
            if (loadingDiv) loadingDiv.remove();
        }
    }

    function updateActiveFile(fileName) {
        if (activeFileName) {
            activeFileName.textContent = fileName || 'No file open';
        }
    }

    function handleSend() {
        const text = chatInput.value;
        if (!text.trim()) return;

        addMessage('user', text);
        vscode.postMessage({ type: 'sendMessage', text: text });

        chatInput.value = '';
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', handleSend);
    }

    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                handleSend();
            }
        });
    }

    // Message handler from extension
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
            case 'addMessage':
                addMessage(message.role, message.text);
                break;
            case 'setLoading':
                setLoading(message.value);
                break;
            case 'clearMessages':
                clearMessages();
                currentMessages = [];
                break;
            case 'activeFileChanged':
                updateActiveFile(message.fileName);
                break;
            case 'historyLoaded':
                if (message.history && Array.isArray(message.history)) {
                    chatHistory = message.history;
                    renderHistory();
                }
                break;
            case 'shareSuccess':
                // Show share success notification
                const notification = document.createElement('div');
                notification.className = 'notification success';
                notification.textContent = message.message || 'Shared successfully!';
                document.body.appendChild(notification);
                setTimeout(() => notification.remove(), 3000);
                break;
        }
    });

    // Request initial active file info
    vscode.postMessage({ type: 'getActiveFile' });
})();
