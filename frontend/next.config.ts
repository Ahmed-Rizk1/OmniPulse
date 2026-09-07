import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  // Dev-only proxy — rewrites are ignored in static export builds
  async rewrites() {
    return [
      { source: "/api/:path*", destination: "http://localhost/api/:path*" },
      { source: "/health",     destination: "http://localhost/health" },
    ];
  },
};

export default nextConfig;
