import type { FileMetadata } from "#/lib/file";
import { atom } from "nanostores";

export type FileUpload = FileMetadata & { file: File };

export const $uploads = atom<FileUpload[]>([]);

export function getUpload(id: string): FileUpload | undefined {
	return $uploads.get().find((u) => u.id === id);
}

export function setUploads(uploads: FileUpload[]) {
	$uploads.set(uploads);
}
