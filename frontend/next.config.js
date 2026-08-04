/** @type {import('next').NextConfig} */

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
  images: {
    domains: ['localhost'],
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  }
}

module.exports = nextConfig