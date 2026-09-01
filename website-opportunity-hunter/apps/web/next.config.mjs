import { loadEnvFileIfPresent } from '../../scripts/load-env.mjs';

// Next.js reads `.env` from this app directory, but configuration for the whole
// workspace lives in one file at the repository root. This runs before the
// server boots, for dev, build and start alike.
loadEnvFileIfPresent();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source; Next compiles them with the app.
  transpilePackages: ['@woh/core', '@woh/config', '@woh/db'],
  // Prisma and bcrypt must run in Node, never be bundled into the edge runtime.
  serverExternalPackages: ['@prisma/client', 'bcryptjs', 'bullmq', 'ioredis'],
  poweredByHeader: false,
  webpack(config) {
    // The workspace packages are ESM TypeScript and import with explicit .js
    // specifiers, which is correct for Node but not something webpack maps back
    // to .ts on its own.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Next injects inline bootstrap scripts and styles.
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
