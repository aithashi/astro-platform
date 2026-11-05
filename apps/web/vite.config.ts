import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Astro Consult",
        short_name: "Astro",
        description: "Book astrology and well-being consultations",
        lang: "en",
        start_url: "/",
        display: "standalone",
        background_color: "#fbf8f3",
        theme_color: "#7a3e1d",
        icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
      },
      workbox: {
        navigateFallback: "/index.html",
        // Never cache Supabase API/auth/storage responses.
        navigateFallbackDenylist: [/^\/functions\//, /^\/auth\//],
      },
      devOptions: { enabled: false },
    }),
  ],
});
