#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
ENV_HAS_JAVA_HOME=false

if [[ -f "$ENV_FILE" ]]; then
	if grep -Eq '^JAVA_HOME=' "$ENV_FILE"; then
		ENV_HAS_JAVA_HOME=true
	fi

	set -a
	# shellcheck disable=SC1090
	source "$ENV_FILE"
	set +a
fi

DEFAULT_JAVA_HOME="$HOME/.local/share/mise/installs/java/temurin-21"
if [[ "$ENV_HAS_JAVA_HOME" == "false" && -x "$DEFAULT_JAVA_HOME/bin/java" ]]; then
	JAVA_HOME="$DEFAULT_JAVA_HOME"
else
	JAVA_HOME="${JAVA_HOME:-$DEFAULT_JAVA_HOME}"
fi
ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
ADB_BIN="${ADB_BIN:-$ANDROID_HOME/platform-tools/adb}"
NPM_BIN="${NPM_BIN:-npm}"
GRADLE_TASK="${GRADLE_TASK:-assembleDebug}"
APK_PATH="${APK_PATH:-$ROOT_DIR/android/app/build/outputs/apk/debug/app-debug.apk}"
APP_ID="${APP_ID:-com.example.codescanner}"
OPEN_AFTER_INSTALL="${OPEN_AFTER_INSTALL:-false}"
SKIP_INSTALL="${SKIP_INSTALL:-false}"

export JAVA_HOME ANDROID_HOME ANDROID_SDK_ROOT
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

if [[ ! -x "$ADB_BIN" ]]; then
	ADB_BIN="$(command -v adb || true)"
fi

if [[ ! -x "$JAVA_HOME/bin/java" ]]; then
	echo "Java nicht gefunden unter JAVA_HOME=$JAVA_HOME. Setze JAVA_HOME in .env." >&2
	exit 1
fi

if ! command -v "$NPM_BIN" >/dev/null 2>&1; then
	echo "npm nicht gefunden. Setze NPM_BIN in .env." >&2
	exit 1
fi

ADB_ARGS=()
if [[ -n "${ADB_SERIAL:-}" ]]; then
	ADB_ARGS=(-s "$ADB_SERIAL")
fi

cd "$ROOT_DIR"

if [[ ! -d node_modules ]]; then
	echo "→ Installiere Node-Abhängigkeiten"
	"$NPM_BIN" install
fi

echo "→ Baue Vite-App"
"$NPM_BIN" run build

echo "→ Synchronisiere Capacitor Android"
"$NPM_BIN" exec -- cap sync android

echo "→ Baue Android APK ($GRADLE_TASK)"
(cd android && ./gradlew "$GRADLE_TASK")

if [[ ! -f "$APK_PATH" ]]; then
	echo "APK nicht gefunden: $APK_PATH" >&2
	exit 1
fi

if [[ "$SKIP_INSTALL" == "true" ]]; then
	echo "✓ Android-APK wurde gebaut: $APK_PATH"
	exit 0
fi

if [[ -z "$ADB_BIN" || ! -x "$ADB_BIN" ]]; then
	echo "ADB nicht gefunden. Setze ANDROID_HOME oder ADB_BIN in .env." >&2
	exit 1
fi

echo "→ Verbundene Geräte"
"$ADB_BIN" devices

echo "→ Installiere/aktualisiere APK: $APK_PATH"
"$ADB_BIN" "${ADB_ARGS[@]}" install -r "$APK_PATH"

if [[ "$OPEN_AFTER_INSTALL" == "true" ]]; then
	echo "→ Starte App $APP_ID"
	"$ADB_BIN" "${ADB_ARGS[@]}" shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null
fi

echo "✓ Android-App wurde aktualisiert."
