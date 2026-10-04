import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Library uploads (PDF test books, audio tracks) can be large.
      bodySizeLimit: "200mb",
    },
  },
};

export default nextConfig;
