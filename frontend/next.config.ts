import type { NextConfig } from "next";
import path from "node:path";
import fs from "node:fs";

// Load root unified .env file if available
const rootEnvPath = path.resolve(process.cwd(), "..", ".env");
const localEnvPath = path.resolve(process.cwd(), ".env");

if (fs.existsSync(rootEnvPath) && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(rootEnvPath);
  } catch (err) {
    console.warn("[NextConfig] Could not load root .env via process.loadEnvFile:", err);
  }
} else if (fs.existsSync(localEnvPath) && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(localEnvPath);
  } catch (err) {
    console.warn("[NextConfig] Could not load local .env via process.loadEnvFile:", err);
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },
  async redirects() {
    return [
      {
        source: "/admin",
        destination: "/admin/dashboard",
        permanent: true,
      },
      {
        source: "/admin/login",
        destination: "/auth/login",
        permanent: true,
      },
      {
        source: "/auth/admin",
        destination: "/auth/login",
        permanent: true,
      },
      {
        source: "/auth/adminlogin",
        destination: "/auth/login",
        permanent: true,
      },
      {
        source: "/auth/citizenlogin",
        destination: "/auth/login",
        permanent: true,
      },
      {
        source: "/dashboard",
        destination: "/citizen/dashboard",
        permanent: true,
      },
      {
        source: "/complaints",
        destination: "/citizen/complaints/new",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:all*(svg|jpg|jpeg|png|webp|avif|woff2|woff|ico)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  env: {
    NEXT_PUBLIC_MAPPLS_API_KEY:
      process.env.NEXT_PUBLIC_MAPPLS_API_KEY || process.env.MAPPLS_API_KEY || "",
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1",
  },
};

export default nextConfig;
