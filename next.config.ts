import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // schema.sql is read at runtime with fs, which the bundler can't see; make
  // sure it ships with the serverless functions.
  outputFileTracingIncludes: { "/**": ["./lib/db/schema.sql"] },
};

export default nextConfig;
