import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Najah.ma — Réussir avec méthode",
    short_name: "Najah.ma",
    description: "Une plateforme marocaine pour réviser, comprendre et progresser.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f6f0",
    theme_color: "#063c32",
    lang: "fr-MA",
    dir: "ltr",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
