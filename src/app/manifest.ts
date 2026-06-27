import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ethik & Co — Temps & frais",
    short_name: "Ethik Badge",
    description: "Badgeage et gestion des temps Ethik & Co",
    start_url: "/badge",
    scope: "/",
    display: "standalone",
    background_color: "#eef0f2",
    theme_color: "#00B0F0",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
