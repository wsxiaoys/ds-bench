/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@trpc/server', '@trpc/client', '@trpc/react-query'],
  },
  // Compile with less memory
  compiler: {
    removeConsole: false,
  },
};

module.exports = nextConfig;
