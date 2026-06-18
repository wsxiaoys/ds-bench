import * as path from "node:path";
import type { NextConfig } from "next";

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");

const nextConfig: NextConfig = {
	output: "export",
	basePath: process.env.NEXT_PUBLIC_BASE_PATH,
	assetPrefix: basePath,
	reactStrictMode: true,
	trailingSlash: true, // generate index.html
	turbopack: {
		root: path.join(__dirname, ".."),
	},
};

export default nextConfig;
