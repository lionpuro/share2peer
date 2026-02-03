import type { FileSystemFileHandle } from "native-file-system-adapter";
import type { Chunk, FileMetadata } from "./file";

type StoredFile = {
	metadata: FileMetadata;
	currentSize: number;
	chunks: { [index: number]: Uint8Array<ArrayBuffer> };
	handle: FileSystemFileHandle | undefined;
};

export interface FileStore {
	getFile(id: string): StoredFile | undefined;
	addFile(file: FileMetadata, handle: FileSystemFileHandle): Promise<void>;
	removeFile(id: string): void;
	getChunk(fileID: string, index: number): Uint8Array | undefined;
	addChunk(chunk: Chunk): void;
	streamFile(id: string): ReadableStream<Uint8Array<ArrayBuffer>>;
	reset(): void;
}

export class FileStoreInMem implements FileStore {
	files: Map<string, StoredFile> = new Map();

	getFile(id: string): StoredFile | undefined {
		return this.files.get(id);
	}

	async addFile(file: FileMetadata, handle: FileSystemFileHandle) {
		this.files.set(file.id, {
			metadata: file,
			currentSize: 0,
			chunks: {},
			handle,
		});
	}

	removeFile(id: string) {
		this.files.delete(id);
	}

	getChunk(fileID: string, index: number): Uint8Array | undefined {
		return this.files.get(fileID)?.chunks[index];
	}

	addChunk(chunk: Chunk) {
		const file = this.files.get(chunk.fileID);
		if (!file) {
			throw new Error("add chunk: file not found");
		}
		file.currentSize += chunk.data.byteLength;
		file.chunks[chunk.index] = chunk.data;
		this.files.set(chunk.fileID, file);
	}

	streamFile(id: string): ReadableStream<Uint8Array<ArrayBuffer>> {
		const file = this.files.get(id);
		if (!file) {
			throw new Error("file not found");
		}
		const chunkCount = Object.keys(file.chunks).length;
		let current = 0;

		return new ReadableStream({
			async pull(controller) {
				try {
					if (current >= chunkCount) {
						controller.close();
						return;
					}

					const chunk = file.chunks[current];
					if (!chunk) {
						controller.error(
							new Error(`missing chunk ${current} for file ${id}`),
						);
						return;
					}

					controller.enqueue(chunk);
					current++;
				} catch (err) {
					controller.error(err);
				}
			},
		});
	}

	reset() {
		this.files = new Map();
	}
}

export const filestore: FileStore = new FileStoreInMem();
