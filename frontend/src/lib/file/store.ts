import type { Chunk, FileMetadata } from "./file";

type StoredFile = {
	metadata: FileMetadata;
	currentSize: number;
	chunks: { [index: number]: Uint8Array };
};

export interface FileStore {
	getFile(id: string): StoredFile | undefined;
	addFile(meta: FileMetadata): void;
	removeFile(id: string): void;
	getChunk(fileID: string, index: number): Uint8Array | undefined;
	addChunk(chunk: Chunk): void;
	getResult(fileID: string): Promise<ReadableStream<Uint8Array>>;
	reset(): void;
}

export class FileStoreInMem implements FileStore {
	files: Map<string, StoredFile> = new Map();

	getFile(id: string): StoredFile | undefined {
		return this.files.get(id);
	}

	addFile(meta: FileMetadata) {
		this.files.set(meta.id, { metadata: meta, currentSize: 0, chunks: {} });
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

	async getResult(fileID: string): Promise<ReadableStream<Uint8Array>> {
		const file = this.files.get(fileID);
		if (!file) {
			throw new Error("file not found");
		}
		const chunkCount = Object.keys(file.chunks).length;
		let current = 0;

		return new ReadableStream<Uint8Array>({
			async pull(controller) {
				try {
					if (current >= chunkCount) {
						controller.close();
						return;
					}

					const chunk = file.chunks[current];
					if (!chunk) {
						controller.error(
							new Error(`missing chunk ${current} for file ${fileID}`),
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
