import { useStore } from "@nanostores/react";
import { $uploads, setUploads } from "#/stores/file";

export function useUpload() {
	const uploads = useStore($uploads);
	return {
		uploads,
		setUploads,
	};
}
