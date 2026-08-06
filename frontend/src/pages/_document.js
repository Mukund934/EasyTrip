import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      {/* Fonts are no longer requested here. `next/font` in `_app.jsx` self-hosts Inter and
          Playfair Display from the build output (IMP-041), which removes the render-blocking
          stylesheet request to fonts.googleapis.com, the two preconnects it needed, and the
          second hop to fonts.gstatic.com for the font files themselves. */}
      <Head />
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
