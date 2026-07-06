(function () {
    const vscode = acquireVsCodeApi();
    const lang = document.documentElement.lang === "tr" ? "tr" : "en";
    const labels = {
        en: {
            newChat: "New Chat",
            noHistory: "No saved chats yet",
            you: "You",
            assistant: "AI Assistant",
            copy: "Copy",
            copied: "Copied",
            insert: "Insert",
            inserted: "Inserted",
            copyCode: "Copy Code",
            share: "Share",
            loading: "Thinking",
            loadingAria: "AI is thinking",
            noFile: "No file open",
            shared: "Shared successfully!"
        },
        tr: {
            newChat: "Yeni Sohbet",
            noHistory: "Henuz kaydedilmis sohbet yok",
            you: "Siz",
            assistant: "AI Asistani",
            copy: "Kopyala",
            copied: "Kopyalandi",
            insert: "Ekle",
            inserted: "Eklendi",
            copyCode: "Kodu Kopyala",
            share: "Paylas",
            loading: "Dusunuyor",
            loadingAria: "Yapay zeka dusunuyor",
            noFile: "Acik dosya yok",
            shared: "Paylasim basarili"
        }
    }[lang];

    const messagesContainer = document.getElementById("messages");
    const chatInput = document.getElementById("chat-input");
    const sendBtn = document.getElementById("send-btn");
    const closeBtn = document.getElementById("close-btn");
    const newChatBtn = document.getElementById("new-chat-btn");
    const historyBtn = document.getElementById("history-btn");
    const historyPanel = document.getElementById("history-panel");
    const closeHistoryBtn = document.getElementById("close-history-btn");
    const historyList = document.getElementById("history-list");
    const activeFileName = document.getElementById("active-file-name");

    let currentMessages = [];
    let chatHistory = [];
    let messageCounter = 0;

    if (chatInput) {
        chatInput.focus();
    }

    if (closeBtn) closeBtn.addEventListener("click", () => vscode.postMessage({ type: "closeChat" }));
    if (newChatBtn) newChatBtn.addEventListener("click", () => {
        if (currentMessages.length > 1) saveChatToHistory();
        vscode.postMessage({ type: "newChat" });
        currentMessages = [];
    });
    if (historyBtn) historyBtn.addEventListener("click", () => toggleHistoryPanel());
    if (closeHistoryBtn) closeHistoryBtn.addEventListener("click", () => toggleHistoryPanel(false));

    function toggleHistoryPanel(show) {
        if (!historyPanel) return;
        const isVisible = historyPanel.classList.contains("visible");
        const nextState = show === undefined ? !isVisible : show;
        historyPanel.classList.toggle("visible", nextState);
        historyPanel.setAttribute("aria-hidden", String(!nextState));
        if (nextState) vscode.postMessage({ type: "loadHistory" });
    }

    function saveChatToHistory() {
        const chatData = {
            id: Date.now(),
            title: getFirstUserMessage() || labels.newChat,
            date: new Date().toLocaleDateString(),
            messages: currentMessages
        };
        chatHistory.unshift(chatData);
        if (chatHistory.length > 20) chatHistory.pop();
        vscode.postMessage({ type: "saveHistory", messages: currentMessages });
    }

    function getFirstUserMessage() {
        const userMsg = currentMessages.find((message) => message.role === "user");
        if (!userMsg) return null;
        return userMsg.text.substring(0, 30) + (userMsg.text.length > 30 ? "..." : "");
    }

    function renderHistory() {
        if (!historyList) return;
        if (chatHistory.length === 0) {
            historyList.innerHTML = `<div class="history-empty">${labels.noHistory}</div>`;
            return;
        }
        historyList.innerHTML = chatHistory.map((chat) => `
            <div class="history-item" data-id="${chat.id}">
                <div class="title">${escapeHtml(chat.title)}</div>
                <div class="date">${chat.date}</div>
            </div>
        `).join("");
        historyList.querySelectorAll(".history-item").forEach((item) => {
            item.addEventListener("click", () => {
                const chatId = parseInt(item.dataset.id, 10);
                loadChatFromHistory(chatId);
            });
        });
    }

    function loadChatFromHistory(chatId) {
        const chat = chatHistory.find((entry) => entry.id === chatId);
        if (!chat) return;
        clearMessages();
        chat.messages.forEach((message) => addMessage(message.role, message.text, false));
        currentMessages = [...chat.messages];
        toggleHistoryPanel(false);
    }

    function escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    function parseMarkdown(text) {
        if (!text) return "";
        let html = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/```(\w*)\n?([\s\S]*?)```/g, (match, language, code) => `<pre class="code-block" data-lang="${language}"><code>${code.trim()}</code></pre>`)
            .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
            .replace(/__([^_]+)__/g, "<strong>$1</strong>")
            .replace(/\*([^*]+)\*/g, "<em>$1</em>")
            .replace(/_([^_]+)_/g, "<em>$1</em>")
            .replace(/^### (.+)$/gm, "<h4>$1</h4>")
            .replace(/^## (.+)$/gm, "<h3>$1</h3>")
            .replace(/^# (.+)$/gm, "<h2>$1</h2>")
            .replace(/^\s*[-*] (.+)$/gm, "<li>$1</li>")
            .replace(/^\s*\d+\. (.+)$/gm, "<li>$1</li>")
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="md-link">$1</a>')
            .replace(/\n/g, "<br>");
        html = html.replace(/(<li>.*?<\/li>)(<br>)?/g, "$1");
        html = html.replace(/(<li>.*?<\/li>)+/g, "<ul>$&</ul>");
        return html;
    }

    function generateMessageId() {
        return `msg-${Date.now()}-${messageCounter++}`;
    }

    function addMessage(role, text, track = true) {
        const messageId = generateMessageId();
        const messageDiv = document.createElement("div");
        messageDiv.className = `message ${role}`;
        messageDiv.id = messageId;
        messageDiv.setAttribute("role", "article");
        messageDiv.setAttribute("aria-label", `${role === "user" ? labels.you : labels.assistant} message`);
        const contentDiv = document.createElement("div");
        contentDiv.className = "content";
        if (role === "agent" || role === "assistant") {
            contentDiv.innerHTML = parseMarkdown(text);
        } else {
            contentDiv.textContent = text;
        }
        messageDiv.appendChild(contentDiv);
        if (role === "agent" || role === "assistant") {
            messageDiv.appendChild(createActionButtons(messageId, text));
        }
        messagesContainer.appendChild(messageDiv);
        if (track && role !== "system") currentMessages.push({ id: messageId, role, text });
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function clearMessages() {
        const welcomeMessage = messagesContainer.querySelector(".message.system");
        messagesContainer.innerHTML = "";
        if (welcomeMessage) messagesContainer.appendChild(welcomeMessage);
    }

    function createActionButton(label, onClick) {
        const button = document.createElement("button");
        button.className = "action-btn";
        button.textContent = label;
        button.setAttribute("aria-label", label);
        button.setAttribute("title", label);
        button.addEventListener("click", onClick);
        return button;
    }

    function createActionButtons(messageId, text) {
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "message-actions";
        actionsDiv.setAttribute("role", "toolbar");
        actionsDiv.setAttribute("aria-label", "Message actions");
        const copyBtn = createActionButton(labels.copy, () => navigator.clipboard.writeText(text).then(() => {
            copyBtn.textContent = labels.copied;
            setTimeout(() => { copyBtn.textContent = labels.copy; }, 2000);
        }));
        actionsDiv.appendChild(copyBtn);
        const insertBtn = createActionButton(labels.insert, () => {
            vscode.postMessage({ type: "insertToEditor", text });
            insertBtn.textContent = labels.inserted;
            setTimeout(() => { insertBtn.textContent = labels.insert; }, 2000);
        });
        actionsDiv.appendChild(insertBtn);
        if (text.includes("```")) {
            const copyCodeBtn = createActionButton(labels.copyCode, () => {
                const codeBlocks = text.match(/```[\w]*\n?([\s\S]*?)```/g);
                if (!codeBlocks) return;
                const code = codeBlocks.map((block) => block.replace(/```[\w]*\n?/, "").replace(/```$/, "").trim()).join("\n\n");
                navigator.clipboard.writeText(code).then(() => {
                    copyCodeBtn.textContent = labels.copied;
                    setTimeout(() => { copyCodeBtn.textContent = labels.copyCode; }, 2000);
                });
            });
            actionsDiv.appendChild(copyCodeBtn);
        }
        actionsDiv.appendChild(createActionButton(labels.share, () => {
            vscode.postMessage({ type: "shareMessage", text, messageId });
        }));
        return actionsDiv;
    }

    function setLoading(isLoading) {
        if (isLoading) {
            const loadingDiv = document.createElement("div");
            loadingDiv.id = "loading-indicator";
            loadingDiv.className = "message agent loading";
            loadingDiv.innerHTML = `<span class="loading-dots">${labels.loading}<span>.</span><span>.</span><span>.</span></span>`;
            loadingDiv.setAttribute("aria-live", "polite");
            loadingDiv.setAttribute("aria-label", labels.loadingAria);
            messagesContainer.appendChild(loadingDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            return;
        }
        const loadingDiv = document.getElementById("loading-indicator");
        if (loadingDiv) loadingDiv.remove();
    }

    function updateActiveFile(fileName) {
        if (activeFileName) activeFileName.textContent = fileName || labels.noFile;
    }

    function handleSend() {
        const text = chatInput.value;
        if (!text.trim()) return;
        addMessage("user", text);
        vscode.postMessage({ type: "sendMessage", text });
        chatInput.value = "";
    }

    if (sendBtn) sendBtn.addEventListener("click", handleSend);
    if (chatInput) {
        chatInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.stopPropagation();
                handleSend();
            }
        });
    }

    window.addEventListener("message", (event) => {
        const message = event.data;
        switch (message.type) {
            case "addMessage":
                addMessage(message.role, message.text);
                break;
            case "setLoading":
                setLoading(message.value);
                break;
            case "clearMessages":
                clearMessages();
                currentMessages = [];
                break;
            case "activeFileChanged":
                updateActiveFile(message.fileName);
                break;
            case "historyLoaded":
                if (message.history && Array.isArray(message.history)) {
                    chatHistory = message.history;
                    renderHistory();
                }
                break;
            case "shareSuccess": {
                const notification = document.createElement("div");
                notification.className = "notification success";
                notification.textContent = message.message || labels.shared;
                document.body.appendChild(notification);
                setTimeout(() => notification.remove(), 3000);
                break;
            }
        }
    });

    vscode.postMessage({ type: "getActiveFile" });
})();
