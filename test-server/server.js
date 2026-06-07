const express = require("express");
const cors = require("cors");

const app = express();
const port = Number(process.env.PORT || 3020);

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.text({ type: ["text/*"], limit: "1mb" }));

app.get("/", (_req, res) => {
	res
		.type("text/plain")
		.send("Code Scanner Test-Server läuft. Sende POST Requests an /.");
});

app.post(/.*/, (req, res) => {
	const timestamp = new Date().toISOString();

	console.log("\n--- Eingehender Scan ---");
	console.log("Zeit:", timestamp);
	console.log("Pfad:", req.originalUrl);
	console.log("Methode:", req.method);
	console.log("IP:", req.ip);
	console.log("Headers:", JSON.stringify(req.headers, null, 2));
	console.log("Body:", JSON.stringify(req.body, null, 2));
	console.log("------------------------\n");

	res.type("text/plain").send("OK");
});

app.use((err, _req, res, _next) => {
	console.error("Fehler beim Verarbeiten der Anfrage:", err);
	res.status(400).type("text/plain").send("NOT OK");
});

app.listen(port, "0.0.0.0", () => {
	console.log(`Code Scanner Test-Server läuft auf http://0.0.0.0:${port}`);
	console.log(`Im Handy als URL z.B. http://<DEINE-IP>:${port} eintragen.`);
});
