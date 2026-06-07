import { useCallback, useEffect, useRef, useState } from "react";
import type { PluginListenerHandle } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import {
	BarcodeFormat,
	BarcodeScanner,
	LensFacing,
	Resolution,
	type Barcode,
} from "@capacitor-mlkit/barcode-scanning";
import "./App.css";

type Screen = "url" | "scanner";
type SendState = "idle" | "sending" | "ok" | "not-ok" | "error";

const LAST_URL_KEY = "last-server-url";
const RESCAN_DELAY_MS = 2_500;

const FORMATS = [
	BarcodeFormat.Aztec,
	BarcodeFormat.Codabar,
	BarcodeFormat.Code39,
	BarcodeFormat.Code93,
	BarcodeFormat.Code128,
	BarcodeFormat.DataMatrix,
	BarcodeFormat.Ean8,
	BarcodeFormat.Ean13,
	BarcodeFormat.Itf,
	BarcodeFormat.Pdf417,
	BarcodeFormat.QrCode,
	BarcodeFormat.UpcA,
	BarcodeFormat.UpcE,
];

function normalizeUrl(value: string) {
	const trimmed = value.trim();
	if (!trimmed) return "";
	return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

function isValidUrl(value: string) {
	try {
		const url = new URL(normalizeUrl(value));
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
}

function responseIsOk(body: string) {
	const trimmed = body.trim();
	const upper = trimmed.toUpperCase();

	if (upper === "NOT OK" || upper === "NOT_OK" || upper === "NOK") return false;
	if (upper === "OK") return true;

	try {
		const parsed = JSON.parse(trimmed) as Record<string, unknown>;
		const status = String(
			parsed.status ?? parsed.result ?? parsed.ok ?? "",
		).toUpperCase();
		if (status === "NOT OK" || status === "NOT_OK" || status === "FALSE")
			return false;
		if (status === "OK" || status === "TRUE") return true;
	} catch {
		// Plain text responses are handled above.
	}

	return false;
}

function App() {
	const [screen, setScreen] = useState<Screen>("url");
	const [serverUrl, setServerUrl] = useState("");
	const [urlError, setUrlError] = useState("");
	const [sendState, setSendState] = useState<SendState>("idle");
	const [lastScan, setLastScan] = useState<{
		content: string;
		type: string;
	} | null>(null);
	const [scannerError, setScannerError] = useState("");
	const [isStartingScanner, setIsStartingScanner] = useState(false);
	const recentScans = useRef(new Map<string, number>());
	const listenerRef = useRef<PluginListenerHandle | null>(null);
	const errorListenerRef = useRef<PluginListenerHandle | null>(null);
	const serverUrlRef = useRef(serverUrl);

	useEffect(() => {
		serverUrlRef.current = serverUrl;
	}, [serverUrl]);

	useEffect(() => {
		Preferences.get({ key: LAST_URL_KEY }).then(({ value }) => {
			if (value) setServerUrl(value);
		});
	}, []);

	const sendBarcode = useCallback(async (barcode: Barcode) => {
		const content = barcode.rawValue || barcode.displayValue;
		const type = barcode.format;
		const key = `${type}:${content}`;
		const now = Date.now();
		const lastSeen = recentScans.current.get(key) ?? 0;

		if (!content || now - lastSeen < RESCAN_DELAY_MS) return;

		recentScans.current.set(key, now);
		setLastScan({ content, type });
		setSendState("sending");

		try {
			const response = await fetch(serverUrlRef.current, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json, text/plain, */*",
				},
				body: JSON.stringify({ content, type }),
			});
			const body = await response.text();
			setSendState(response.ok && responseIsOk(body) ? "ok" : "not-ok");
		} catch (error) {
			console.error("Fehler beim Senden des Barcodes", error);
			setSendState("error");
		}
	}, []);

	const stopScanner = useCallback(async () => {
		document.body.classList.remove("barcode-scanner-active");
		document.documentElement.classList.remove("barcode-scanner-active");
		await listenerRef.current?.remove();
		await errorListenerRef.current?.remove();
		listenerRef.current = null;
		errorListenerRef.current = null;
		await BarcodeScanner.stopScan().catch(() => undefined);
	}, []);

	const startScanner = useCallback(async () => {
		setScannerError("");
		setIsStartingScanner(true);

		try {
			const { supported } = await BarcodeScanner.isSupported();
			if (!supported) {
				setScannerError("Dieses Gerät unterstützt keinen Barcode-Scanner.");
				return;
			}

			let { camera } = await BarcodeScanner.checkPermissions();
			if (camera !== "granted" && camera !== "limited") {
				({ camera } = await BarcodeScanner.requestPermissions());
			}
			if (camera !== "granted" && camera !== "limited") {
				setScannerError("Kamera-Berechtigung wurde nicht erteilt.");
				return;
			}

			document.body.classList.add("barcode-scanner-active");
			document.documentElement.classList.add("barcode-scanner-active");

			listenerRef.current = await BarcodeScanner.addListener(
				"barcodesScanned",
				(event) => {
					for (const barcode of event.barcodes) {
						void sendBarcode(barcode);
					}
				},
			);
			errorListenerRef.current = await BarcodeScanner.addListener(
				"scanError",
				(event) => {
					setScannerError(event.message);
				},
			);

			await BarcodeScanner.startScan({
				formats: FORMATS,
				lensFacing: LensFacing.Back,
				resolution: Resolution["1280x720"],
			});
		} catch (error) {
			console.error("Scanner konnte nicht gestartet werden", error);
			document.body.classList.remove("barcode-scanner-active");
			document.documentElement.classList.remove("barcode-scanner-active");
			setScannerError("Scanner konnte nicht gestartet werden.");
		} finally {
			setIsStartingScanner(false);
		}
	}, [sendBarcode]);

	useEffect(() => {
		return () => {
			void stopScanner();
		};
	}, [stopScanner]);

	const continueToScanner = async () => {
		const normalized = normalizeUrl(serverUrl);
		if (!isValidUrl(normalized)) {
			setUrlError("Bitte gib eine gültige HTTP- oder HTTPS-URL ein.");
			return;
		}

		setServerUrl(normalized);
		setUrlError("");
		await Preferences.set({ key: LAST_URL_KEY, value: normalized });
		setScreen("scanner");
		requestAnimationFrame(() => {
			void startScanner();
		});
	};

	const goBack = async () => {
		await stopScanner();
		setScreen("url");
		setSendState("idle");
	};

	if (screen === "scanner") {
		return (
			<main className="scanner-screen barcode-scanner-modal">
				<div
					className={`status-dot ${sendState}`}
					aria-label={`Sendestatus: ${sendState}`}
				/>
				<header className="scanner-header">
					<button className="secondary-button" type="button" onClick={goBack}>
						Zurück
					</button>
					<div>
						<p className="eyebrow">Sende an</p>
						<p className="server-url">{serverUrl}</p>
					</div>
				</header>

				<section className="scanner-frame" aria-live="polite">
					<div className="corner top-left" />
					<div className="corner top-right" />
					<div className="corner bottom-left" />
					<div className="corner bottom-right" />
					{isStartingScanner ? (
						<p>Scanner wird gestartet…</p>
					) : (
						<p>Code in den Rahmen halten</p>
					)}
				</section>

				{lastScan ? (
					<aside className="last-scan">
						<span>{lastScan.type}</span>
						<strong>{lastScan.content}</strong>
					</aside>
				) : null}

				{scannerError ? (
					<p className="error scanner-error">{scannerError}</p>
				) : null}
			</main>
		);
	}

	return (
		<main className="url-screen">
			<section className="card">
				<p className="eyebrow">Code Scanner</p>
				<h1>Server verbinden</h1>
				<p className="description">
					Gib die REST-API-URL ein. Jeder erkannte Code wird als JSON per POST
					dorthin gesendet.
				</p>

				<label htmlFor="server-url">Server-URL</label>
				<input
					id="server-url"
					inputMode="url"
					placeholder="http://192.168.0.100:3020"
					value={serverUrl}
					onChange={(event) => setServerUrl(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") void continueToScanner();
					}}
				/>
				{urlError ? <p className="error">{urlError}</p> : null}

				<button
					className="primary-button"
					type="button"
					onClick={continueToScanner}
				>
					Weiter
				</button>
			</section>
		</main>
	);
}

export default App;
