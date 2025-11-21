const DEFAULT_USER_AGENT =
	"Mozilla/5.0 (X11; IridiumOS Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Fixcraft";
const BASE_VERSION = `${import.meta.env.VITE_VERSION_FULL || import.meta.env.VITE_VERSION || ""}`.trim();
const DEFAULT_APP_VERSION = BASE_VERSION ? `Fixcraft ${BASE_VERSION}` : "Fixcraft";
const DEFAULT_SYSTEM_VERSION = "IridiumOS Linux";

type MaybeOverrides = {
	apiId?: number | string;
	api_id?: number | string;
	apiHash?: string;
	api_hash?: string;
	userAgent?: string;
	deviceModel?: string;
	systemVersion?: string;
	appVersion?: string;
};

const rawOverrides = (globalThis as any).__IR_TELEGRAM_OVERRIDES as MaybeOverrides | undefined;

const parsedApiId = (() => {
	if (!rawOverrides) return undefined;
	const value = rawOverrides.apiId ?? rawOverrides.api_id;
	const maybeNumber = typeof value === "string" ? Number.parseInt(value, 10) : value;
	return Number.isFinite(maybeNumber as number) ? (maybeNumber as number) : undefined;
})();

const parsedApiHash =
	(rawOverrides?.apiHash && String(rawOverrides.apiHash)) ||
	(rawOverrides?.api_hash && String(rawOverrides.api_hash)) ||
	undefined;

const parsedUserAgent = rawOverrides?.userAgent?.trim() || undefined;
const parsedDeviceModel = rawOverrides?.deviceModel?.trim() || undefined;
const parsedSystemVersion = rawOverrides?.systemVersion?.trim() || undefined;
const parsedAppVersion = rawOverrides?.appVersion?.trim() || undefined;

const userAgent = parsedUserAgent || DEFAULT_USER_AGENT;

export const TELEGRAM_CLIENT = {
	apiId: parsedApiId,
	apiHash: parsedApiHash,
	userAgent,
	deviceModel: parsedDeviceModel || userAgent,
	systemVersion: parsedSystemVersion || DEFAULT_SYSTEM_VERSION,
	appVersion: parsedAppVersion || DEFAULT_APP_VERSION,
};

export function resolveApiId(defaultId: number) {
	return TELEGRAM_CLIENT.apiId ?? defaultId;
}

export function resolveApiHash(defaultHash: string) {
	return TELEGRAM_CLIENT.apiHash ?? defaultHash;
}
