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

export function createTwebApp() {
  const app = express();
  app.set("etag", false);
  app.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  app.use(compression());
  app.use(express.static(PUBLIC_DIR));

  // SPA fallback (don’t mutate obfuscated index!)
  app.get("*", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));
  return app;
}
