const endpointInput = document.getElementById("endpointUrl");
const tokenInput = document.getElementById("sessionToken");
const saveButton = document.getElementById("save");
const status = document.getElementById("status");

async function loadSettings() {
  const settings = await chrome.storage.local.get({
    endpointUrl: "",
    sessionToken: "",
    lastStatus: "Waiting for configuration."
  });

  endpointInput.value = settings.endpointUrl;
  tokenInput.value = settings.sessionToken;
  status.textContent = settings.lastStatus;
}

saveButton.addEventListener("click", async () => {
  await chrome.storage.local.set({
    endpointUrl: endpointInput.value.trim(),
    sessionToken: tokenInput.value.trim(),
    lastStatus: "Connection settings saved. Right-click a page element and choose Inspect for AccessiMind."
  });

  status.textContent = "Connection settings saved. Right-click a page element and choose Inspect for AccessiMind.";
});

void loadSettings();
