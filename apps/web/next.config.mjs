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
}

export default nextConfig
