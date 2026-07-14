/// <reference lib="webworker" />

declare let self: ServiceWorkerGlobalScope;

const WRITE = 0;
const PULL = 0;
const ERROR = 1;
const ABORT = 1;
const CLOSE = 2;

type Chunk = ArrayBufferView<ArrayBuffer>;

type Message = {
	type: number;
	chunk: Chunk;
	reason: unknown;
};

class MessagePortSource implements UnderlyingSource<Chunk> {
	port: MessagePort;
	controller: ReadableStreamDefaultController<Chunk> | undefined;

	constructor(port: MessagePort) {
		this.port = port;
		this.port.onmessage = (e) => this.onMessage(e.data);
	}

	start(ctrl: ReadableStreamDefaultController<Chunk>) {
		this.controller = ctrl;
	}

	pull() {
		this.port.postMessage({ type: PULL });
	}

	cancel(reason: Error) {
		this.port.postMessage({ type: ERROR, reason: reason.message });
		this.port.close();
	}

	onMessage(message: Message) {
		if (message.type === WRITE) {
			this.controller?.enqueue(message.chunk);
		}
		if (message.type === ABORT) {
			this.controller?.error(message.reason);
			this.port.close();
		}
		if (message.type === CLOSE) {
			this.controller?.close();
			this.port.close();
		}
	}
}

self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", (e) => {
	e.waitUntil(self.clients.claim());
});

type Download = {
	url: string;
	headers: Record<string, string>;
	stream?: ReadableStream;
} & ({ readablePort: MessagePort } | { readable: ReadableStream });

const downloads = new Map<string, Download>();

self.addEventListener("message", (e) => {
	const data: unknown = e.data;
	if (!data || typeof data !== "object") return;

	if ("type" in data && data.type === "native-file-system-adapter/ping") {
		// Respond to handshake ping so the main thread knows this SW supports downloads
		e.ports[0]?.postMessage({ type: "native-file-system-adapter/pong" });
		return;
	}

	if (!("url" in data) || !("headers" in data)) return;

	if ("readable" in data) {
		// Preferred: transferred ReadableStream received directly
		const dl = { ...(data as Download) };
		dl.stream = data.readable as ReadableStream;
		downloads.set(dl.url, dl);
		return;
	}

	if ("readablePort" in data) {
		// Fallback: reconstruct ReadableStream from MessagePort
		const dl = { ...(data as Download) };
		dl.stream = new ReadableStream(
			new MessagePortSource(e.data.readablePort),
			new CountQueuingStrategy({ highWaterMark: 4 }),
		);
		downloads.set(dl.url, dl);
		return;
	}
});

self.addEventListener("fetch", (e) => {
	const url = e.request.url;
	const data = downloads.get(url);
	if (!data) return;
	downloads.delete(url);

	e.respondWith(
		new Response(data.stream, {
			headers: data.headers,
		}),
	);
});
