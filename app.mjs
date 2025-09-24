// tweb/app.mjs (ESM)
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import express from "express";
import compression from "compression";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicFolderName = process.env.TWEB_PUBLIC || "public";
const PUBLIC_DIR = path.join(__dirname, publicFolderName);
const INJECTION_ROUTE = "/__iridium-tweb-inject.js";
const INJECTION_FILE = path.join(__dirname, "injs.js");
const INJECTION_SNIPPET = `<script src="${INJECTION_ROUTE}" data-iridium="telegram-inject" defer></script>`;

function injectAndSendHtml(filePath, res, next) {
  fs.readFile(filePath, "utf8", (error, html) => {
    if (error) return next();
    let output = html;
    if (!html.includes(INJECTION_ROUTE)) {
      if (html.includes("</head>")) {
        output = html.replace("</head>", `${INJECTION_SNIPPET}\n</head>`);
      } else {
        output = `${html}\n${INJECTION_SNIPPET}`;
      }
    }
    res.type("text/html").send(output);
  });
}

export function createTwebApp() {
  const app = express();
  app.set("etag", false);
  app.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  app.use(compression());

  if (fs.existsSync(INJECTION_FILE)) {
    app.get(INJECTION_ROUTE, (_req, res) => {
      res.type("application/javascript");
      res.sendFile(INJECTION_FILE);
    });

    app.use((req, res, next) => {
      if (req.method !== "GET") return next();
      const accept = req.headers.accept || "";
      if (!accept.includes("text/html")) return next();
      const relativePath = req.path === "/" ? "index.html" : req.path.replace(/^\/+/, "");
      const targetPath = path.join(PUBLIC_DIR, relativePath);
      fs.stat(targetPath, (err, stats) => {
        if (err || !stats.isFile()) return next();
        injectAndSendHtml(targetPath, res, next);
      });
    });
  }

  app.use(express.static(PUBLIC_DIR));

  // SPA fallback (don’t mutate obfuscated index!)
  app.get("*", (req, res, next) => {
    const indexFile = path.join(PUBLIC_DIR, "index.html");
    if (fs.existsSync(INJECTION_FILE)) {
      injectAndSendHtml(indexFile, res, next);
    } else {
      res.sendFile(indexFile);
    }
  });
  return app;
}
