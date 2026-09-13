import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Photos embedded in an imported Excel file are sent to the server a
      // few at a time; the 1 MB default is smaller than a single decent
      // product photo, let alone a batch of them.
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
