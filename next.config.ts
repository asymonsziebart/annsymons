import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve ??= {};
      config.resolve.fallback ??= {};
      config.resolve.fallback.fs = false;
      config.resolve.alias ??= {};
      config.resolve.alias.plist = path.join(
        process.cwd(),
        "node_modules/plist/dist/index.browser.js",
      );
    }
    return config;
  },
};

export default nextConfig;
