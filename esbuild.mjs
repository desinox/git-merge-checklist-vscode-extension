import * as esbuild from "esbuild";

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const extensionConfig = {
	entryPoints: ["src/extension.ts"],
	bundle: true,
	format: "cjs",
	platform: "node",
	target: "node18",
	outfile: "dist/extension.js",
	external: ["vscode"],
	sourcemap: !production,
	minify: production,
	logLevel: "info",
};

/** @type {import('esbuild').BuildOptions} */
const webviewConfig = {
	entryPoints: ["webview/index.tsx"],
	bundle: true,
	format: "iife",
	platform: "browser",
	target: "es2021",
	outfile: "dist/webview.js",
	jsx: "automatic",
	loader: { ".css": "css" },
	sourcemap: !production,
	minify: production,
	define: {
		"process.env.NODE_ENV": production ? '"production"' : '"development"',
	},
	logLevel: "info",
};

async function main() {
	if (watch) {
		const ctxExt = await esbuild.context(extensionConfig);
		const ctxWeb = await esbuild.context(webviewConfig);
		await Promise.all([ctxExt.watch(), ctxWeb.watch()]);
		console.log("[esbuild] watching...");
	} else {
		await Promise.all([
			esbuild.build(extensionConfig),
			esbuild.build(webviewConfig),
		]);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
