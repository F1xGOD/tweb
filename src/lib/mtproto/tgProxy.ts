export type TgProxyConfig = {
	enabled: boolean;
	wsPath?: string;
	httpPath?: string;
	forceIp?: string;
};

const DEFAULT_WS_PATH = "/tgproxy/ws";
const DEFAULT_HTTP_PATH = "/tgproxy/http";

let cachedConfig: TgProxyConfig | null | undefined;

function normalize(raw: any): TgProxyConfig | null {
	if (!raw) return null;
	const enabled =
		raw.enabled ??
		raw.enable ??
		raw.proxyEnable ??
		raw.proxy_enabled ??
		raw.proxyEnabled;
	const isOn = String(enabled ?? "").toLowerCase();
	const active = enabled === true || ["1", "true", "yes", "on", "y"].includes(isOn);
	const wsPath =
		raw.wsPath ||
		raw.proxyWsPath ||
		raw["data-proxy-ws-path"] ||
		raw.ws_path ||
		raw.ws;
	const httpPath =
		raw.httpPath ||
		raw.proxyHttpPath ||
		raw["data-proxy-http-path"] ||
		raw.http_path ||
		raw.http;
	const forceIp = raw.forceIp || raw.force_ip;
	return {
		enabled: Boolean(active),
		wsPath: wsPath || undefined,
		httpPath: httpPath || undefined,
		forceIp: forceIp || undefined,
	};
}

export function setTgProxyConfig(raw: any) {
	cachedConfig = normalize(raw);
	(globalThis as any).__IR_TG_PROXY = cachedConfig || undefined;
	return cachedConfig;
}

export function getTgProxyConfig(): TgProxyConfig | null {
	if (cachedConfig !== undefined) return cachedConfig;
	cachedConfig = normalize((globalThis as any).__IR_TG_PROXY);
	return cachedConfig;
}

export function bootstrapTgProxyFromSearch() {
	try {
		const search = (globalThis.location && globalThis.location.search) || "";
		if (!search) return;
		const params = new URLSearchParams(search);
		if (params.get("tgProxy") !== "1") return;
		setTgProxyConfig({
			enabled: true,
			wsPath: params.get("wsPath") || undefined,
			httpPath: params.get("httpPath") || undefined,
			forceIp: params.get("forceIp") || undefined,
		});
	} catch {
		// ignore
	}
}

function maybeProxy(url: string, kind: "ws" | "http") {
	const cfg = getTgProxyConfig();
	if (!cfg?.enabled) return url;
	const base =
		typeof location !== "undefined"
			? kind === "ws"
				? location.origin.replace(/^http/, "ws")
				: location.origin
			: null;
	if (!base) return url;
	const path =
		kind === "ws" ? cfg.wsPath || DEFAULT_WS_PATH : cfg.httpPath || DEFAULT_HTTP_PATH;
	const target = encodeURIComponent(url);
	return `${base}${path}?target=${target}`;
}

export function rewriteTelegramWsUrl(url: string) {
	return maybeProxy(url, "ws");
}

export function rewriteTelegramHttpUrl(url: string) {
	return maybeProxy(url, "http");
}
