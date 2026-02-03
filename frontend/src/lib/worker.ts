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
	readablePort: MessagePort;
	stream?: ReadableStream;
};

const downloads = new Map<string, Download>();

self.addEventListener("message", (e) => {
	const data: unknown = e.data;
	if (!data || typeof data !== "object") return;
	if (!("url" in data) || !("readablePort" in data)) return;

	const dl = { ...(data as Download) };
	dl.stream = new ReadableStream(
		new MessagePortSource(e.data.readablePort),
		new CountQueuingStrategy({ highWaterMark: 4 }),
	);
	downloads.set(dl.url, dl);
});

self.addEventListener("fetch", (e) => {
	const url = e.request.url;
	const data = downloads.get(url);
	if (!data) return null;
	downloads.delete(url);

	e.respondWith(
		new Response(data.stream, {
			headers: data.headers,
		}),
	);
});
