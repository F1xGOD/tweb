// Iridium/FixCraft TWeb entry: inject identity + proxy and serve static build
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import express from "express";
import compression from "compression";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TWEB_ROOT = __dirname;
const publicFolderName = process.env.TWEB_PUBLIC || "public";
const PUBLIC_DIR = path.join(TWEB_ROOT, publicFolderName);
const INJECTION_ROUTE = "/__iridium-tweb-inject.js";
const INJECTION_FILE = path.join(TWEB_ROOT, "injs.js");

function readIridiumIdentity() {
	const IRIDIUM_TS_PATH = path.join(TWEB_ROOT, "..", "..", "src", "Iridium.ts");
	try {
		const src = fs.readFileSync(IRIDIUM_TS_PATH, "utf8");
		const getString = (key) => {
			const match = src.match(new RegExp(`${key}\\s*:\\s*"(.*?)"`));
			return match ? match[1] : null;
		};
		const major = getString("major");
		const minor = getString("minor");
		const patch = getString("patch");
		const buildstate = getString("buildstate");
		const codename = getString("codename");
		const versionParts = [major, minor, patch].filter(Boolean);
		const version = versionParts.length ? versionParts.join(".") : null;
		let pretty = version;
		if (pretty && buildstate && buildstate.toUpperCase() !== "STABLE") {
			pretty += `-${buildstate}`;
		}
		const friendly =
			pretty && codename ? `Iridium ${pretty} ${codename}` :
				pretty ? `Iridium ${pretty}` :
					codename ? `Iridium ${codename}` :
						"Iridium";
		return {version: pretty || version, codename, friendly};
	} catch {
		return {};
	}
}

const IRIDIUM_IDENTITY = readIridiumIdentity();

const DEFAULT_USER_AGENT =
	process.env.TWEB_USER_AGENT_OVERRIDE ||
	"Mozilla/5.0 (X11; IridiumOS Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Fixcraft";
const DEFAULT_DEVICE_MODEL =
	process.env.TWEB_DEVICE_MODEL ||
	IRIDIUM_IDENTITY.friendly ||
	"Iridium Device";
const DEFAULT_SYSTEM_VERSION =
	process.env.TWEB_SYSTEM_VERSION ||
	(IRIDIUM_IDENTITY.version ? `IridiumOS ${IRIDIUM_IDENTITY.version}` : "IridiumOS Linux");
const DEFAULT_APP_VERSION =
	process.env.TWEB_APP_VERSION ||
	IRIDIUM_IDENTITY.friendly ||
	"Iridium Client";

const PROXY_ENABLED = (process.env.TWEB_PROXY_ENABLE ?? "1").toLowerCase() !== "0";
const PROXY_WS_PATH = process.env.TWEB_PROXY_WS_PATH || "/tgproxy/ws";
const PROXY_HTTP_PATH = process.env.TWEB_PROXY_HTTP_PATH || "/tgproxy/http";

const INJECTION_DATA_ATTRS = {
	"data-api-id": process.env.TWEB_API_ID,
	"data-api-hash": process.env.TWEB_API_HASH,
	"data-user-agent": DEFAULT_USER_AGENT,
	"data-device-model": DEFAULT_DEVICE_MODEL,
	"data-system-version": DEFAULT_SYSTEM_VERSION,
	"data-app-version": DEFAULT_APP_VERSION,
	"data-proxy-enable": PROXY_ENABLED ? "1" : "0",
	"data-proxy-ws-path": PROXY_WS_PATH,
	"data-proxy-http-path": PROXY_HTTP_PATH,
};
const INJECTION_ATTRS_STRING = Object.entries(INJECTION_DATA_ATTRS)
	.filter(([, value]) => Boolean(value))
	.map(([key, value]) => `${key}="${String(value).replace(/"/g, "&quot;")}"`)
	.join(" ");
const INJECTION_SNIPPET = `<script src="${INJECTION_ROUTE}" data-iridium="telegram-inject"${
	INJECTION_ATTRS_STRING ? ` ${INJECTION_ATTRS_STRING}` : ""
}></script>`;

function injectAndSendHtml(filePath, res, next) {
	fs.readFile(filePath, "utf8", (error, html) => {
		if (error) return next();
		let output = html;
		if (!html.includes(INJECTION_ROUTE) && fs.existsSync(INJECTION_FILE)) {
			const headOpen = html.match(/<head[^>]*>/i);
			if (headOpen && headOpen[0]) {
				output = html.replace(headOpen[0], `${headOpen[0]}\n${INJECTION_SNIPPET}`);
			} else if (html.includes("</head>")) {
				output = html.replace("</head>", `${INJECTION_SNIPPET}\n</head>`);
			} else {
				output = `${INJECTION_SNIPPET}\n${html}`;
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
