import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@zenfs/core", "@zenfs/dom", "kerium", "utilium"],
}

export default nextConfig
