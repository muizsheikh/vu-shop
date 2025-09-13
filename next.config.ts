// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },      // don't fail on ESLint in CI
  typescript: { ignoreBuildErrors: true },    // don't fail on TS type errors in CI
};

export default nextConfig;
