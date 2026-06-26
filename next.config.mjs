/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Remotion usa WebAssembly y otros binarios que conviene eximir del bundling del server
  experimental: {
    serverComponentsExternalPackages: ["@remotion/renderer", "@remotion/bundler", "remotion"],
  },
  webpack: (config) => {
    // Ignorar módulos de Node que Remotion arranca sólo en el render server-side
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
    };
    return config;
  },
};

export default nextConfig;
