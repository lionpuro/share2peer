import { showSaveFilePicker } from "native-file-system-adapter";

export interface Download {
	start(): Promise<void>;
	abort(): Promise<void>;
	close(): void;
	enqueue(chunk: Uint8Array<ArrayBuffer>): void;
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
	stream(): ReadableStream<Uint8Array<ArrayBuffer>>;
	controller: ReadableStreamDefaultController<Uint8Array<ArrayBuffer>>;
}

function createReadable(): Promise<Readable> {
	return new Promise((resolve) => {
		const stream = new ReadableStream<Uint8Array<ArrayBuffer>>({
			start(controller) {
				resolve({ stream: () => stream, controller });
			},
		});
	});
}

export async function createDefaultWriteStream(filename: string) {
	const handle = await showSaveFilePicker({
		_preferPolyfill: false,
		suggestedName: filename,
	});
	const stream = await handle.createWritable();
	return stream;
}

export function createBlobWriteStream(filename: string, filetype?: string) {
	let chunks: Uint8Array<ArrayBuffer>[] = [];
	const stream = new WritableStream<Uint8Array<ArrayBuffer>>({
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
