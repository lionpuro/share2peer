import { useStore } from "@nanostores/react";
import { $uploads, setUploads } from "#/lib/file";

export function useUpload() {
	const uploads = useStore($uploads);
	return {
		uploads,
		setUploads,
	};
}
