import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp is a native module — keep it external so its platform binaries are
  // traced into the serverless bundle instead of being (mis)bundled.
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
