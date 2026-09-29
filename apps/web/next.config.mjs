import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "../../.env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["localhost", "*.trycloudflare.com", "*.ngrok-free.dev", "*.ngrok.io"],
  experimental: {
    proxyClientMaxBodySize: "512mb",
    serverActions: { bodySizeLimit: "512mb" },
  },
  async redirects() {
    return [{ source: "/services", destination: "/dashboard", permanent: false }];
  },
  async rewrites() {
    return [
      // App Router serves /terms and /privacy. Keep Chinese aliases for TikTok reviewers.
      { source: "/%E6%9C%8D%E5%8A%A1%E6%9D%A1%E6%AC%BE", destination: "/legal/terms.html" },
      { source: "/%E9%9A%90%E7%A7%81%E6%94%BF%E7%AD%96", destination: "/legal/privacy.html" },
    ];
  },
};

export default nextConfig;
