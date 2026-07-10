/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["@remotion/renderer", "@remotion/bundler", "remotion"],
  },
  async rewrites() {
    return [
      {
        source: "/assets/:path*",
        destination: "/api/files/assets/:path*",
      },
    ];
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
    };
    return config;
  },
};

export default nextConfig;
