import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { OfflineSupport } from "@/components/offline";
import appCss from "../styles.css?url";
import broadcastCss from "../broadcast-next.css?url";
import nfl2k5Css from "../nfl2k5.css?url";

const APP_NAME = "NFL Rewind";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "theme-color", content: "#04050a" },
      { name: "description", content: "Start in 1966. Draft the real classes. Rewrite football history." },
      { name: "apple-mobile-web-app-title", content: "NFL Rewind" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black" },
      { property: "og:title", content: "NFL Rewind" },
      { property: "og:description", content: "Start in 1966. Draft the real classes. Rewrite football history." },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://polar-rose-rocket-blend.vercel.app/og.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg?v=rewind-next" },
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: broadcastCss },
      { rel: "stylesheet", href: nfl2k5Css },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <OfflineSupport />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
