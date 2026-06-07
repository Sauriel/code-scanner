import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
	appId: "com.example.codescanner",
	appName: "Code Scanner",
	webDir: "dist",
	server: {
		androidScheme: "http",
		cleartext: true,
	},
};

export default config;
