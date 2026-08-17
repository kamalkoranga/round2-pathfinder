import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone emits a self-contained server bundle in .next/standalone, which
  // the Dockerfile copies. It must NOT be set on Vercel: Vercel runs its own
  // file tracing and fails with a missing `next-server.js.nft.json`.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
};

export default nextConfig;
