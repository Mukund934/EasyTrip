/** @type {import('next').NextConfig} */

// Fail-fast environment validation (IMP-100). next.config.js is loaded by `dev`, `build`, `start`
// and `lint` alike, which makes it the only hook that runs before the app regardless of how it was
// started. A missing NEXT_PUBLIC_* is inlined into the bundle as `undefined` at build time, so it
// has to be caught here — after the build it is baked into the artifact.
//
// Only `next build` is fatal; every other command warns. See env.validation.js for why.
require('./env.validation').validateEnv();

// Browser-tier security headers (IMP-058). helmet covers the Express API; nothing
// covered the pages the browser actually loads, so the site was framable — a
// clickjacking route straight at the admin console (SECURITY_AUDIT 10.2).
//
// The CSP here deliberately declares `frame-ancestors` and nothing else. That is the
// one directive that cannot be set from a <meta> tag and the one the audit asked for,
// and a CSP carrying no fetch directives cannot break script, style or image loading.
// A full script-src/style-src policy needs a live build plus a click-through of
// Firebase auth, Google One Tap, the Maps embed, Leaflet tiles and Cloudinary, so it
// is left to a later hardening pass rather than guessed at here.
//
// frame-ancestors governs who may frame US; the Google Maps <iframe> on the place
// page is unaffected.
const securityHeaders = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
];

const nextConfig = {
  reactStrictMode: true,
  // Stop advertising the framework and its version.
  poweredByHeader: false,
  // `unoptimized: true` disabled the optimizer globally, so every `next/image` in the codebase
  // did nothing at all — no resizing, no WebP/AVIF, no srcset — while still paying the component's
  // overhead (IMP-049). Removing it is what makes the three existing usages, and any migrated
  // `<img>`, actually optimize.
  images: {
    // `remotePatterns` rather than the deprecated `domains`: it constrains protocol and path, so
    // only Cloudinary delivery URLs are proxied. An over-broad allowlist turns the optimizer into
    // an open image proxy that anyone can point at arbitrary hosts.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**'
      }
    ],
    // Modern formats first; Next falls back to the original when the browser cannot accept them.
    formats: ['image/avif', 'image/webp'],
    // The widths actually used: cards render around 400px, the detail hero full-bleed. Trimming
    // the default ladder avoids generating variants nothing requests.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [64, 96, 128, 256, 384],
    // Optimized derivatives are immutable for their URL, so let the browser keep them.
    minimumCacheTTL: 60 * 60 * 24 * 30
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders
      }
    ];
  }
};

module.exports = nextConfig;
