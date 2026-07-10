import { showSaveFilePicker } from "#/lib/native-file-system-adapter";
import type { ChunkData } from "./file";

export interface DownloadStream {
	start(): Promise<void>;
	abort(): void;
	close(): void;
	enqueue(chunk: ChunkData): void;
}

export async function createDownloadStream(
	header: FileHeader,
): Promise<DownloadStream> {
	const readable = await createReadable();
	const writable = await createWritable(header);
	return {
		async start() {
			await readable.stream().pipeTo(writable);
		},
		abort() {
			readable.controller.error("download canceled");
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

async function createWritable(file: FileHeader) {
	const handle = await showSaveFilePicker({
		_preferPolyfill: false,
		suggestedName: file.name,
	});
	const stream = await handle.createWritable({ size: file.size });
	return stream;
}
