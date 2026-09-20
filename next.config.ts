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
  images: {
    // Next 16 restricts next/image `quality` to an explicit allowlist
    // (default is just [75]) — the home page's hero photo asks for full
    // quality, so 100 has to be added here or it silently falls back to 75.
    qualities: [75, 100],
  },
};

export default nextConfig;
