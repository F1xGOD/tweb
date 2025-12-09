const https = require("https");
const http = require("http");
const fs = require("fs");

const thirdTour = process.argv[2] == 3;
const forcePort = process.argv[3];
const useHttp = process.argv[4] !== "https";

const publicFolderName = thirdTour ? "public3" : "public";
const port = forcePort ? +forcePort : thirdTour ? 8443 : 80;

// Keep the public folder selection in sync with the shared app module
if (!process.env.TWEB_PUBLIC) {
	process.env.TWEB_PUBLIC = publicFolderName;
}

async function start() {
	const {createTwebApp} = await import("./app.mjs");
	const app = createTwebApp();

	const serverFactory = useHttp ? http : https;
	const options = {};
	if (!useHttp) {
		options.key = fs.readFileSync(__dirname + "/certs/server-key.pem");
		options.cert = fs.readFileSync(__dirname + "/certs/server-cert.pem");
	}

	const server = serverFactory.createServer(options, app);
	const handleUpgrade = app.tgProxy?.handleUpgrade;
	if (typeof handleUpgrade === "function") {
		server.on("upgrade", (req, socket, head) => {
			if (handleUpgrade(req, socket, head)) {
				return;
			}
			socket.destroy();
		});
	}

	server.listen(port, () => {
		console.log("Listening port:", port, "folder:", publicFolderName, "https:", !useHttp);
	});
}

start().catch((error) => {
	console.error("[server] Failed to start:", error);
	process.exit(1);
});
