import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./styles.css";

export const metadata: Metadata = {
  title: {
    default: "BatchCommerce",
    template: "%s | BatchCommerce"
  },
  description: "Batch-first shop operations for growing commerce teams.",
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  themeColor: "#103c37",
  colorScheme: "light"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
