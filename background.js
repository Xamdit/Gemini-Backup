chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "BACKUP_ACTIVE_TAB") {
    return false;
  }

  (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url || new URL(tab.url).hostname !== "gemini.google.com") {
      throw new Error("Open a Gemini conversation in the active tab first.");
    }

    let result;
    try {
      result = await chrome.tabs.sendMessage(tab.id, { type: "BACKUP_GEMINI_PAGE" });
    } catch {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
      result = await chrome.tabs.sendMessage(tab.id, { type: "BACKUP_GEMINI_PAGE" });
    }
    sendResponse(result);
  })().catch((error) => {
    sendResponse({ ok: false, error: error.message });
  });

  return true;
});
