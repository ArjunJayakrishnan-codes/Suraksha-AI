import { createRoot } from "react-dom/client";
import "./index.css";

async function bootstrap() {
	console.log("[Bootstrap] Starting app initialization...");
	
	// Try to fetch runtime config from backend
	try {
		console.log("[Bootstrap] Fetching /api/public-config...");
		const response = await fetch("/api/public-config", { 
			headers: { Accept: "application/json" },
			cache: "no-store"
		});
		
		if (response.ok) {
			const config = await response.json();
			console.log("[Bootstrap] Runtime config loaded:", {
				supabaseUrl: config?.supabaseUrl ? "✓ set" : "✗ missing",
				supabasePublishableKey: config?.supabasePublishableKey ? "✓ set" : "✗ missing",
			});
			
			if (config?.supabaseUrl && config?.supabasePublishableKey) {
				window.__APP_CONFIG__ = {
					supabaseUrl: config.supabaseUrl,
					supabasePublishableKey: config.supabasePublishableKey,
				};
				console.log("[Bootstrap] Runtime config applied successfully.");
			}
		} else {
			console.warn("[Bootstrap] /api/public-config returned status:", response.status);
		}
	} catch (err) {
		console.warn("[Bootstrap] Failed to fetch /api/public-config:", err);
	}

	// Check build-time env vars
	const buildTimeUrl = import.meta.env.VITE_SUPABASE_URL;
	const buildTimeKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
	console.log("[Bootstrap] Build-time env vars:", {
		VITE_SUPABASE_URL: buildTimeUrl ? "✓ set" : "✗ missing",
		VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? "✓ set" : "✗ missing",
		VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? "✓ set" : "✗ missing",
	});
	
	console.log("[Bootstrap] Final config state:", {
		runtimeConfig: window.__APP_CONFIG__ ? "✓ set" : "✗ missing",
		buildTimeVars: buildTimeUrl || buildTimeKey ? "✓ available" : "✗ missing",
	});
	
	console.log("[Bootstrap] Rendering app...");
	const { default: App } = await import("./App.tsx");
	createRoot(document.getElementById("root")!).render(<App />);
}

bootstrap();
