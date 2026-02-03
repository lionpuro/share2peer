import { defineConfig, loadEnv, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import icons from "unplugin-icons/vite";
import basicSSL from "@vitejs/plugin-basic-ssl";
import { resolve } from "path";

function serviceworker(): PluginOption {
	return {
		name: "serviceworker",
		apply: "serve",
		configureServer(server) {
			server.middlewares.use("/worker.js", async (req, res, next) => {
				const transformed = await server.transformRequest(
					"./src/lib/worker.ts",
				);
				if (!transformed) {
					return next();
				}
				res.setHeader("Content-Type", "application/javascript");
				res.end(transformed.code);
				if (req.url === "/worker.js") {
					res.setHeader("Content-Type", "text/javascript");
					res.writeHead(200);
				}
			});
		},
	};
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	process.env = loadEnv(mode, process.cwd(), "");
	return {
		build: {
			rollupOptions: {
				input: {
					index: resolve(__dirname, "index.html"),
					worker: resolve(__dirname, "src/lib/worker.ts"),
				},
				output: {
					entryFileNames: (info) => {
						if (info.name === "worker") {
							return `${info.name}.js`;
						}
						return "assets/[name].[hash].js";
					},
					assetFileNames: "assets/[name].[hash][extname]",
				},
			},
		},
		clearScreen: false,
		plugins: [
			basicSSL({ name: "development" }),
			tailwindcss(),
			tanstackRouter({
				target: "react",
				autoCodeSplitting: true,
			}),
			react({
				babel: {
					plugins: [["babel-plugin-react-compiler"]],
				},
			}),
			icons({ compiler: "jsx", jsx: "react" }),
			serviceworker(),
		],
		resolve: {
			alias: {
				"#": resolve(__dirname, "./src"),
			},
		},
		server: {
			proxy: {
				"/signals": {
					target: `${process.env.VITE_DEV_WS_SERVER}`,
					ws: true,
					changeOrigin: true,
					rewrite: (path) => path.replace(/^\/signals/, ""),
				},
			},
		},
	};
});
