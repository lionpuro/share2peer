interface ImportMetaEnv {
	VITE_DEV_WS_SERVER?: string;
	VITE_WS_HOST: string;
	VITE_WS_ENDPOINT: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
