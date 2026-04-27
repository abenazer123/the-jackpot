import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the floating route-info indicator that Next.js renders in dev
  // mode. We want screenshots / live testing to look like the real
  // experience without the badge in the corner.
  devIndicators: false,
};

export default nextConfig;
