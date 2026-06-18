/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_ZEALT_RUN_ID: process.env.ZEALT_RUN_ID,
    NEXT_PUBLIC_CONVEX_URL: process.env.CONVEX_URL,
  },
};

export default nextConfig;
