import { CHUNK_DATA_SIZE } from "../webrtc";

type OnReaderRead = (chunk: Uint8Array) => Promise<void>;

export class ChunkReader {
	#reading: boolean = false;

	async read(file: File, onRead?: OnReaderRead): Promise<void> {
		this.#reading = true;

		const stream = file.stream();
		const reader = stream.getReader();

		const read = async () => {
			const { value } = await reader.read();
			if (!value) return;
			let buf = value;

			while (buf.byteLength) {
				if (!this.#reading) return;
				const chunk = buf.slice(0, CHUNK_DATA_SIZE);
				buf = buf.slice(CHUNK_DATA_SIZE);
				await onRead?.(chunk);
			}
			await read();
		};
		await read();
	}

	stop() {
		this.#reading = false;
	}
}
