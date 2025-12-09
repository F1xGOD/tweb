// Iridium/FixCraft TWeb entry: inject identity + proxy and serve static build
import path from "path";
import os from "os";
import fs from "fs";
import http from "http";
import https from "https";
import { fileURLToPath } from "url";
import express from "express";
import compression from "compression";
import httpProxy from "http-proxy";

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
const TG_PROXY_ALLOWED_HOST_RE = /(?:^|\.)web\.telegram\.org$/i;
const PREFERRED_WG_IFACES = (process.env.TWEB_PROXY_WG_IFACES || "wg0,wg1")
	.split(",")
	.map((value) => value.trim())
	.filter(Boolean);

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

function pickLocalProxyAddress() {
	const envAddress = (process.env.TWEB_PROXY_LOCAL_ADDRESS || "").trim();
	if (envAddress) return envAddress;
	const interfaces = os.networkInterfaces();
	const preferred = PREFERRED_WG_IFACES.length ? PREFERRED_WG_IFACES : [];
	const candidates = [];
	for (const name of preferred) {
		if (interfaces[name]) {
			candidates.push([name, interfaces[name]]);
		}
	}
	if (!candidates.length) {
		for (const [name, entries] of Object.entries(interfaces)) {
			if (name.startsWith("wg")) {
				candidates.push([name, entries]);
			}
		}
	}
	for (const [, entries] of candidates) {
		const match = (entries || []).find((entry) => entry && !entry.internal && entry.family === "IPv4" && entry.address);
		if (match) return match.address;
	}
	return null;
}

const LOCAL_PROXY_ADDRESS = pickLocalProxyAddress();
const HTTP_PROXY_AGENT = new http.Agent({
	keepAlive: true,
	...(LOCAL_PROXY_ADDRESS ? {localAddress: LOCAL_PROXY_ADDRESS} : {}),
});
const HTTPS_PROXY_AGENT = new https.Agent({
	keepAlive: true,
	...(LOCAL_PROXY_ADDRESS ? {localAddress: LOCAL_PROXY_ADDRESS} : {}),
});

function parseTelegramTarget(raw, allowedProtocols = []) {
	if (!raw) return null;
	try {
		const target = new URL(raw);
		if (allowedProtocols.length && !allowedProtocols.includes(target.protocol)) return null;
		if (!TG_PROXY_ALLOWED_HOST_RE.test(target.hostname)) return null;
		return target;
	} catch {
		return null;
	}
}

function buildProxyOptions(target) {
	const isSecure = target.protocol === "https:" || target.protocol === "wss:";
	return {
		target: `${target.protocol}//${target.host}`,
		changeOrigin: true,
		ws: true,
		secure: isSecure,
		agent: isSecure ? HTTPS_PROXY_AGENT : HTTP_PROXY_AGENT,
		headers: {host: target.host},
	};
}

function createTelegramProxy(app) {
	const proxy = httpProxy.createProxyServer({});
	let loggedBind = false;
	const logBind = () => {
		if (loggedBind || !LOCAL_PROXY_ADDRESS) return;
		loggedBind = true;
		console.log(`[tweb][tgproxy] routing upstream via ${LOCAL_PROXY_ADDRESS}`);
	};

	proxy.on("error", (error, req, res) => {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`[tgproxy] upstream error: ${message}`);
		if (res && typeof res.writeHead === "function") {
			if (!res.headersSent) {
				res.writeHead(502, {"Content-Type": "text/plain"});
			}
			res.end("upstream error");
		} else if (res && typeof res.destroy === "function") {
			res.destroy();
		} else if (req && req.socket) {
			req.socket.destroy();
		}
	});

	const handleHttpProxy = (req, res) => {
		logBind();
		const targetRaw = req.query?.target || req.headers["x-tg-target"];
		const target = parseTelegramTarget(targetRaw, ["http:", "https:"]);
		if (!target) {
			return res.status(400).type("text/plain").send("invalid target");
		}
		const proxyOptions = buildProxyOptions(target);
		const originalUrl = req.url;
		req.url = target.pathname + target.search;
		proxy.web(req, res, proxyOptions);
		req.url = originalUrl;
	};

	const handleUpgrade = (req, socket, head) => {
		let parsed;
		try {
			parsed = new URL(req.url, `http://${req.headers.host || "localhost"}`);
		} catch {
			return false;
		}
		if (parsed.pathname !== PROXY_WS_PATH) return false;

		const target = parseTelegramTarget(parsed.searchParams.get("target"), ["ws:", "wss:"]);
		if (!target) {
			socket.destroy();
			return true;
		}

		logBind();
		socket.on("error", () => socket.destroy());
		const proxyOptions = buildProxyOptions(target);
		const originalUrl = req.url;
		req.url = target.pathname + target.search;
		proxy.ws(req, socket, head, proxyOptions);
		req.url = originalUrl;
		return true;
	};

	app.all(PROXY_HTTP_PATH, handleHttpProxy);
	return handleUpgrade;
}

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
	const handleProxyUpgrade = PROXY_ENABLED ? createTelegramProxy(app) : null;

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

	app.tgProxy = handleProxyUpgrade ? {
		httpPath: PROXY_HTTP_PATH,
		wsPath: PROXY_WS_PATH,
		handleUpgrade: handleProxyUpgrade,
	} : null;
	return app;
}
