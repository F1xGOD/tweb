(function () {
  function replaceInTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const value = node.nodeValue;
    if (value && value.includes("F1xGOD")) {
      node.nodeValue = value.replace(/F1xGOD/g, "Owner");
    }
  }

  function walk(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let current = walker.nextNode();
    while (current) {
      replaceInTextNode(current);
      current = walker.nextNode();
    }
  }

  function observe() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          replaceInTextNode(mutation.target);
        }
        for (const node of mutation.addedNodes || []) {
          if (node.nodeType === Node.TEXT_NODE) {
            replaceInTextNode(node);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            walk(node);
          }
        }
      }
    });
    observer.observe(document.documentElement || document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  function init() {
    walk(document.body || document.documentElement);
    observe();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
