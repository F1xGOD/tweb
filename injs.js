(function () {
  // Identity defaults
  const DEFAULT_USER_AGENT = "Mozilla/5.0 (X11; IridiumOS Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Fixcraft";
  const DEFAULT_DEVICE_MODEL = "Iridium Device";
  const DEFAULT_SYSTEM_VERSION = "IridiumOS Linux";
  const DEFAULT_APP_VERSION = "Iridium Client";

  const script = document.currentScript || document.querySelector('script[data-iridium="telegram-inject"]');
  const dataset = (script && script.dataset) || {};

  const identity = {
    apiId: dataset.apiId ? Number(dataset.apiId) : undefined,
    apiHash: dataset.apiHash || undefined,
    userAgent: dataset.userAgent || DEFAULT_USER_AGENT,
    deviceModel: dataset.deviceModel || DEFAULT_DEVICE_MODEL,
    systemVersion: dataset.systemVersion || DEFAULT_SYSTEM_VERSION,
    appVersion: dataset.appVersion || DEFAULT_APP_VERSION
  };

  const proxyEnabled = dataset.proxyEnable !== "0" && dataset.proxyEnable !== "false";
  const proxyWsPath = dataset.proxyWsPath || "/tgproxy/ws";
  const proxyHttpPath = dataset.proxyHttpPath || "/tgproxy/http";
  const wsProxyBase = (location.origin.replace(/^http/, "ws")) + proxyWsPath;
  const httpProxyBase = location.origin + proxyHttpPath;

  const TELEGRAM_HOST_RE = /(?:^|\.)web\.telegram\.org$/i;
  const isTelegramHost = (host) => TELEGRAM_HOST_RE.test(host || "");

  function shouldProxyWs(url) {
    try {
      const u = typeof url === "string" ? new URL(url) : url;
      return (u.protocol === "ws:" || u.protocol === "wss:") &&
        isTelegramHost(u.hostname) &&
        /apiws/i.test(u.pathname);
    } catch(_) {
      return false;
    }
  }

  function shouldProxyHttp(url) {
    try {
      const u = typeof url === "string" ? new URL(url) : url;
      return (u.protocol === "http:" || u.protocol === "https:") &&
        isTelegramHost(u.hostname) &&
        /apiw/i.test(u.pathname);
    } catch(_) {
      return false;
    }
  }

  function rewriteWs(url) {
    return wsProxyBase + "?target=" + encodeURIComponent(url);
  }
  function rewriteHttp(url) {
    return httpProxyBase + "?target=" + encodeURIComponent(url);
  }

  if (proxyEnabled) {
    const NativeWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
      let target = url;
      try {
        if (shouldProxyWs(url)) {
          target = rewriteWs(typeof url === "string" ? url : url.toString());
        }
      } catch {}
      return new NativeWebSocket(target, protocols);
    };
    window.WebSocket.prototype = NativeWebSocket.prototype;

    const nativeFetch = window.fetch ? window.fetch.bind(window) : null;
    if (nativeFetch) {
      window.fetch = (input, init) => {
        try {
          const urlStr = typeof input === "string" ? input : input?.url;
          if (urlStr && shouldProxyHttp(urlStr)) {
            input = rewriteHttp(urlStr);
          }
        } catch {}
        return nativeFetch(input, init);
      };
    }

    const nativeOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      try {
        if (url && shouldProxyHttp(url)) {
          url = rewriteHttp(url);
        }
      } catch {}
      return nativeOpen.call(this, method, url, ...rest);
    };
  }

  const existing = (globalThis).__IR_TELEGRAM_OVERRIDES || {};
  globalThis.__IR_TELEGRAM_OVERRIDES = Object.assign({}, existing, identity);

  function patchNavigator() {
    const nav = navigator;
    const ua = identity.userAgent;
    const platform = "IridiumOS x86_64";
    const patch = (key, value) => {
      try {
        Object.defineProperty(nav, key, {
          get: () => value,
          configurable: true
        });
      } catch(_) {
        try {
          nav[key] = value;
        } catch(__) {}
      }
    };
    patch("userAgent", ua);
    patch("appVersion", ua);
    patch("platform", platform);
    patch("productSub", ua);
    patch("oscpu", platform);
  }

  patchNavigator();

  // Make sure the overrides stay in place after page scripts mutate them
  const NAV_PATCH_INTERVAL_MS = 3000;
  setInterval(patchNavigator, NAV_PATCH_INTERVAL_MS);

  // Preserve the earlier DOM/text replacement logic if present
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
