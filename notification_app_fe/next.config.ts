import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['logging-middleware'],
  async rewrites() {
    return [
      {
        source: '/evaluation-service/:path*',
        destination: 'http://20.207.122.201/evaluation-service/:path*'
      }
    ];
  }
};

export default nextConfig;
