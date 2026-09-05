import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AU Electronic",
    template: "%s | AU Electronic",
  },
  description: "Sistem manajemen pesanan AU Electronic",
};

// Applies the saved/system theme to <html> before the browser paints, per
// Next's documented flash-prevention pattern (preventing-flash-before-hydration.md):
// a synchronous inline script in <head> runs during HTML parsing, ahead of
// React. suppressHydrationWarning on <html> tells React to keep whatever
// class the script already set rather than reverting to the server's (always
// light) render. Falls back to prefers-color-scheme when nothing is saved yet.
const themeInitScript = `(function(){try{var t=localStorage.getItem("theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
