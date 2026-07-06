const MENU_ID = "accessimind-inspect";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Inspect for AccessiMind",
    contexts: ["all"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) {
    return;
  }

  const settings = await chrome.storage.local.get({
    endpointUrl: "",
    sessionToken: ""
  });

  if (!settings.endpointUrl || !settings.sessionToken) {
    await chrome.storage.local.set({
      lastStatus: "Set the session endpoint and token in the AccessiMind Companion popup first."
    });
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: "accessimind-capture-selection" }, async (payload) => {
    if (chrome.runtime.lastError) {
      await chrome.storage.local.set({
        lastStatus: chrome.runtime.lastError.message || "AccessiMind content script is unavailable on this page."
      });
      return;
    }

    if (!payload || payload.error) {
      await chrome.storage.local.set({
        lastStatus: payload?.error || "No element was captured for AccessiMind."
      });
      return;
    }

    try {
      const response = await fetch(settings.endpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionToken: settings.sessionToken,
          payload
        })
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || `HTTP ${response.status}`);
      }

      await chrome.storage.local.set({
        lastStatus: "Selection sent to AccessiMind."
      });
    } catch (error) {
      await chrome.storage.local.set({
        lastStatus: error instanceof Error ? error.message : String(error)
      });
    }
  });
});
