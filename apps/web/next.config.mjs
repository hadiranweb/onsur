/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Lint runs as a dedicated CI step (`pnpm lint`) rather than during build.
    ignoreDuringBuilds: true,
  },
  transpilePackages: [
    '@element-plus/domain',
    '@element-plus/contracts',
    '@element-plus/application',
  ],
  // Keep `pg` external to the server bundle so it resolves from node_modules
  // at runtime (Next 14 experimental key).
  experimental: {
    serverComponentsExternalPackages: ['pg'],
  },
}

export default nextConfig
