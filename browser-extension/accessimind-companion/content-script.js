(function () {
  let lastContextElement = null;

  const IGNORED_TAGS = new Set(["HTML", "BODY", "HEAD", "META", "LINK", "SCRIPT", "STYLE"]);

  function isInspectable(element) {
    return !!element && !!element.tagName && !IGNORED_TAGS.has(element.tagName);
  }

  function selectorFor(element) {
    if (element.id) {
      return `#${element.id}`;
    }

    const parts = [];
    let node = element;

    while (node && node.nodeType === 1 && parts.length < 6) {
      let part = node.tagName.toLowerCase();

      if (node.classList && node.classList.length) {
        part += `.${Array.from(node.classList).slice(0, 2).join(".")}`;
      }

      if (node.parentElement) {
        const siblings = Array.from(node.parentElement.children).filter((child) => child.tagName === node.tagName);
        const index = siblings.indexOf(node);
        if (index >= 0) {
          part += `:nth-of-type(${index + 1})`;
        }
      }

      parts.unshift(part);
      node = node.parentElement;
    }

    return parts.join(" > ");
  }

  function parentChainFor(element) {
    const chain = [];
    let current = element;

    while (current && current.nodeType === 1 && chain.length < 6) {
      chain.unshift(current.tagName.toLowerCase());
      current = current.parentElement;
    }

    return chain;
  }

  function flashElement(element) {
    const previousOutline = element.style.outline;
    element.style.outline = "2px solid #f97316";
    window.setTimeout(() => {
      element.style.outline = previousOutline;
    }, 900);
  }

  document.addEventListener("contextmenu", (event) => {
    const target = event.target && event.target.closest ? event.target.closest("*") : null;
    if (!isInspectable(target)) {
      lastContextElement = null;
      return;
    }

    lastContextElement = target;
    flashElement(target);
  }, true);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "accessimind-capture-selection") {
      return;
    }

    if (!lastContextElement || !isInspectable(lastContextElement)) {
      sendResponse({ error: "Right-click the target element first, then choose Inspect for AccessiMind." });
      return;
    }

    sendResponse({
      outerHTML: lastContextElement.outerHTML,
      selector: selectorFor(lastContextElement),
      tagName: lastContextElement.tagName.toLowerCase(),
      textPreview: (lastContextElement.textContent || "").trim().slice(0, 160),
      parentChain: parentChainFor(lastContextElement),
      contextHtml: (lastContextElement.parentElement ? lastContextElement.parentElement.outerHTML : lastContextElement.outerHTML).slice(0, 6000),
      pageUrl: window.location.href,
      pageTitle: document.title || ""
    });
  });
})();
