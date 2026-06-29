import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CondoTracker — Gestione spese condominiali",
    short_name: "CondoTracker",
    description:
      "Per amministratori di condominio: spese, quote per millesimi, notifiche e pagamenti con bonifico e QR code SEPA.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#f1f5f9",
    theme_color: "#1b5df5",
    lang: "it",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
