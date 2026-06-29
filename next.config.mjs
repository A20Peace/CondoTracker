/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Server Actions are enabled by default in Next 14; raise body limit for uploads.
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
