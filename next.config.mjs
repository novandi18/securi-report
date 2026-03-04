/** @type {import("next").NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker deployments
  output: "standalone",

  // Raise Server Actions body limit for PDF uploads (default 1 MB)
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },

  // ─── Security Headers ───────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // HSTS: force HTTPS for 1 year, include subdomains, allow preload
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          // Prevent MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Prevent click-jacking
          { key: "X-Frame-Options", value: "DENY" },
          // Disable referrer for cross-origin requests
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Disable browser features we don't use
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          // CSP: restrict sources; allow 'self', inline styles (needed for KaTeX/Tailwind), data: URIs for images
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
              "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data: https://cdn.jsdelivr.net",
              "connect-src 'self' https:",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          // Prevent cross-origin information leakage
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
        port: ""
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: ""
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        port: ""
      },
      {
        protocol: "https",
        hostname: "pub-b7fd9c30cdbf439183b75041f5f71b92.r2.dev",
        port: ""
      }
    ]
  }
};

export default nextConfig;
