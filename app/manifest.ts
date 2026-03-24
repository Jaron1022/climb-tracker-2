import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Climb Tracker",
    short_name: "Climb",
    description: "Track climbs, photos, and progress at your gym.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5efe4",
    theme_color: "#d86f2d",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml"
      },
      {
        src: "/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml"
      },
      {
        src: "/maskable-icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ]
  };
}
