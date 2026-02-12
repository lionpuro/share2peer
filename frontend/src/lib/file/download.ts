import { showSaveFilePicker } from "#/lib/native-file-system-adapter";
import type { ChunkData } from "./file";

export interface Download {
	start(): Promise<void>;
	abort(): Promise<void>;
	close(): void;
	enqueue(chunk: ChunkData): void;
}

export async function createDownload(
	writable: WritableStream<ChunkData>,
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

type FileHeader = {
	name: string;
	mime: string;
	size: number;
};

export async function createWriteStream(header: FileHeader) {
	const streamable = !("safari" in window) && !("WebKitPoint" in window);
	const stream = streamable
		? await createDefaultWriteStream(header)
		: createBlobWriteStream(header);
	return stream;
}

async function createDefaultWriteStream(file: FileHeader) {
	const handle = await showSaveFilePicker({
		_preferPolyfill: false,
		suggestedName: file.name,
	});
	const stream = await handle.createWritable({ size: file.size });
	return stream;
}

function createBlobWriteStream(file: FileHeader) {
	let chunks: ChunkData[] = [];
	const stream = new WritableStream<ChunkData>({
		write(chunk) {
			chunks.push(chunk);
		},
		close() {
			const blob = new Blob(chunks, {
				type: file.mime || "application/octet-stream; charset=utf-8",
			});
			const link = document.createElement("a");
			link.href = URL.createObjectURL(blob);
			link.download = file.name;
			link.click();
		},
		abort() {
			chunks = [];
		},
	});
	return stream;
}
