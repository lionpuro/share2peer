interface ImportMetaEnv {
	VITE_WS_PROTOCOL: string;
	VITE_WS_HOST: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
