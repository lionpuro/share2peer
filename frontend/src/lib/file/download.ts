import { showSaveFilePicker } from "#/lib/native-file-system-adapter";
import type { ChunkData } from "./file";

export interface Download {
	start(): Promise<void>;
	abort(): Promise<void>;
	close(): void;
	enqueue(chunk: ChunkData): void;
}

export async function createDownload(
	writable: WritableStream,
): Promise<Download> {
	const readable = await createReadable();
	return {
		async start() {
			await readable.stream().pipeTo(writable);
		},
		async abort() {
			readable.controller.close();
			await writable.abort();
		},
		close() {
			readable.controller.close();
		},
		enqueue(chunk) {
			readable.controller.enqueue(chunk);
		},
	};
}

interface Readable {
	stream(): ReadableStream<ChunkData>;
	controller: ReadableStreamDefaultController<ChunkData>;
}

function createReadable(): Promise<Readable> {
	return new Promise((resolve) => {
		const stream = new ReadableStream<ChunkData>({
			start(controller) {
				resolve({ stream: () => stream, controller });
			},
		});
	});
}

export async function createDefaultWriteStream(
	filename: string,
	filesize: number,
) {
	const handle = await showSaveFilePicker({
		_preferPolyfill: false,
		suggestedName: filename,
	});
	const stream = await handle.createWritable({ size: filesize });
	return stream;
}

export function createBlobWriteStream(filename: string, filetype?: string) {
	let chunks: ChunkData[] = [];
	const stream = new WritableStream<ChunkData>({
		write(chunk) {
			chunks.push(chunk);
		},
		close() {
			const blob = new Blob(chunks, {
				type: filetype || "application/octet-stream; charset=utf-8",
			});
			const link = document.createElement("a");
			link.href = URL.createObjectURL(blob);
			link.download = filename;
			link.click();
		},
		abort() {
			chunks = [];
		},
	});
	return stream;
}
