import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import icons from "unplugin-icons/vite";
import basicSSL from "@vitejs/plugin-basic-ssl";
import { resolve } from "path";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	process.env = loadEnv(mode, process.cwd(), "");
	return {
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
