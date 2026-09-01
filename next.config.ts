import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  outputFileTracingIncludes: {
    "/*": ["./data/itur.db", "./data/uploads/**/*"],
  },
};

export default nextConfig;
