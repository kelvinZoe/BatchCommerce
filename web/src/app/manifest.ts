import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BatchCommerce",
    short_name: "BatchCommerce",
    description: "Batch-first shop operations for growing commerce teams.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf8ef",
    theme_color: "#103c37",
    icons: [
      { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" }
    ]
  };
}
