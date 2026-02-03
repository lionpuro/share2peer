import { atom } from "nanostores";
import { nanoid } from "nanoid";
import * as z from "zod/mini";

type FileUpload = FileMetadata & { file: File };

export const $uploads = atom<FileUpload[]>([]);

export function getUpload(id: string): FileUpload | undefined {
	return $uploads.get().find((u) => u.id === id);
}

export function setUploads(uploads: FileUpload[]) {
	$uploads.set(uploads);
}

export function deleteUploads() {
	$uploads.set([]);
}

export type Chunk = {
	fileID: string;
	index: number;
	data: Uint8Array<ArrayBuffer>;
};

export const FileMetadataSchema = z.object({
	id: z.string(),
	name: z.string(),
	mime: z.string(),
	size: z.number(),
});

export type FileMetadata = z.infer<typeof FileMetadataSchema>;

export function createFileMetadata(file: File): FileMetadata {
	return {
		id: nanoid(),
		name: file.name,
		mime: file.type,
		size: file.size,
	};
}

export function downloadBlob(blob: Blob, name: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.style.display = "none";
	a.href = url;
	a.download = name;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 100);
}
