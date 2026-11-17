(function registerBackupListener() {
  const listenerKey = "__geminiBackupMessageListener";
  if (globalThis[listenerKey]) {
    chrome.runtime.onMessage.removeListener(globalThis[listenerKey]);
  }

  const listener = (message, _sender, sendResponse) => {
    if (message?.type !== "BACKUP_GEMINI_PAGE") {
      return false;
    }

    (async () => {
      await scrollToConversationStart();
      downloadSnapshot(createStaticSnapshot());
      return { ok: true };
    })()
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  };

  globalThis[listenerKey] = listener;
  chrome.runtime.onMessage.addListener(listener);
})();

async function scrollToConversationStart() {
  const scroller = findScroller();
  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

  scroller.scrollTop = scroller.scrollHeight;
  let stableBottomPasses = 0;
  let previousHeight = -1;

  for (let pass = 0; pass < 40 && stableBottomPasses < 3; pass += 1) {
    await wait(300);
    const height = scroller.scrollHeight;
    if (height === previousHeight) {
      stableBottomPasses += 1;
    } else {
      stableBottomPasses = 0;
      previousHeight = height;
      scroller.scrollTop = height;
    }
  }

  for (let step = 0; step < 600 && scroller.scrollTop > 0; step += 1) {
    const distance = Math.max(200, Math.floor(scroller.clientHeight * 0.75));
    scroller.scrollTop = Math.max(0, scroller.scrollTop - distance);
    await wait(250);
  }

  if (scroller.scrollTop > 0) {
    scroller.scrollTop = 0;
    await wait(500);
  }
}

function findScroller() {
  const root = document.scrollingElement || document.documentElement;
  if (root.scrollHeight > root.clientHeight + 20) {
    return root;
  }

  let candidate = root;
  for (const element of document.querySelectorAll("body *")) {
    const style = getComputedStyle(element);
    if (
      element.scrollHeight > element.clientHeight + 20 &&
      /(auto|scroll|overlay)/.test(style.overflowY) &&
      element.scrollHeight > candidate.scrollHeight
    ) {
      candidate = element;
    }
  }
  return candidate;
}

function createStaticSnapshot() {
  const conversation = findConversationRoot();
  const excludedElements = [
    "script",
    "iframe",
    "object",
    "embed",
    "meta[charset]",
    "meta[http-equiv]",
    "nav",
    "aside",
    "[role='navigation']",
    "[role='complementary']",
    "[role='toolbar']",
    "[role='menu']",
    "[role='menubar']",
    "mat-sidenav",
    "[class*='side-nav']",
    "[class*='sidenav']",
    "[class*='sidebar']",
    "[data-test-id*='sidenav']",
    "[data-test-id*='side-nav']",
    "button",
    "form",
    "input",
    "textarea",
    "[contenteditable='true']",
    "chat-input"
  ].join(", ");
  const content = conversation.cloneNode(true);
  content.querySelectorAll(excludedElements).forEach((element) => element.remove());
  content.querySelectorAll("*").forEach((element) => {
    for (const attribute of [...element.attributes]) {
      if (attribute.name.toLowerCase().startsWith("on")) {
        element.removeAttribute(attribute.name);
      } else if (
        ["href", "src", "xlink:href"].includes(attribute.name.toLowerCase()) &&
        /^\s*javascript:/i.test(attribute.value)
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  });

  const title = document.title || "Gemini conversation";
  const page = document.implementation.createHTMLDocument(title);
  page.documentElement.lang = document.documentElement.lang || "th";
  const charset = page.createElement("meta");
  charset.setAttribute("charset", "utf-8");
  const viewport = page.createElement("meta");
  viewport.name = "viewport";
  viewport.content = "width=device-width, initial-scale=1";
  const base = page.createElement("base");
  base.href = location.href;
  page.head.prepend(base);
  page.head.prepend(viewport);
  page.head.prepend(charset);

  document.head.querySelectorAll("link[rel~='stylesheet'], style").forEach((style) => {
    page.head.append(style.cloneNode(true));
  });

  const snapshotStyle = page.createElement("style");
  snapshotStyle.textContent = `
    body { margin: 0 auto; max-width: 900px; padding: 24px; color: #202124; font: 16px/1.6 Arial, sans-serif; }
    user-query, model-response { display: block; margin: 0 0 24px; }
    img, video { max-width: 100%; height: auto; }
    pre { overflow-x: auto; white-space: pre-wrap; }
  `;
  page.head.append(snapshotStyle);
  page.body.replaceChildren(content);

  return `<!doctype html>\n${page.documentElement.outerHTML}`;
}

function findConversationRoot() {
  const userMessages = document.querySelectorAll(
    "user-query, [data-test-id*='user-query']"
  );
  const modelMessages = document.querySelectorAll(
    "model-response, [data-test-id*='model-response']"
  );
  const messages = [...userMessages, ...modelMessages];

  if (userMessages.length === 0 || modelMessages.length === 0) {
    throw new Error(
      "ไม่พบเนื้อหาบทสนทนา Gemini ในหน้านี้ กรุณาเปิดบทสนทนาให้โหลดเสร็จแล้วลองอีกครั้ง"
    );
  }

  let root = messages[0].parentElement;
  while (root && root !== document.body && !messages.every((message) => root.contains(message))) {
    root = root.parentElement;
  }

  if (!root || root === document.body || root === document.documentElement) {
    throw new Error("ไม่สามารถแยกส่วนบทสนทนาออกจากส่วนอื่นของหน้า Gemini ได้");
  }

  return root;
}

function downloadSnapshot(html) {
  const title = document.title || "Gemini conversation";
  const safeTitle = title.replace(/[\\/:*?"<>|]+/g, "_").trim().slice(0, 100) || "Gemini conversation";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${safeTitle}-${timestamp}.html`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.documentElement.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
