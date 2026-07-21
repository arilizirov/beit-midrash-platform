import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Strict by default; project-specific config grows here as slices land.
  reactStrictMode: true,
  turbopack: {
    // Pin the workspace root. Without this, Next walks up and finds the stray
    // package-lock.json in the user's HOME directory, infers that as the root,
    // and watches the wrong tree — the dev server then serves a stale build
    // and silently ignores every source edit. Found while trying to falsify
    // the e2e suite: sabotaging BOTH auth layers changed nothing, because the
    // running server never recompiled.
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
