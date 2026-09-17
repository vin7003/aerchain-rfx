import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force the fabricated vendor-reply files under public/vendor-replies/ into
  // every serverless function's bundle. Without this, Next.js's build-time
  // file tracer can miss them for the extract route because the filename is
  // built from data (vendor.fileName) rather than a literal string it can see
  // statically — which caused fs.readFile(process.cwd() + "/public/...") to
  // fail with ENOENT in production even though it always works in local dev
  // (full filesystem always present there). This is the direct, zero-latency
  // fix; the extract route also falls back to fetching the file's public URL
  // if, for any reason, it's still missing from the bundle.
 // trigger redeploy
  outputFileTracingIncludes: {
    "/*": ["./public/vendor-replies/**/*"],
  },
};

export default nextConfig;
