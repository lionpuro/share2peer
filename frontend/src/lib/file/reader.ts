import { CHUNK_DATA_SIZE } from "../webrtc";
import type { ChunkData } from "./file";

type OnReaderRead = (chunk: ChunkData, index: number) => Promise<void>;

export class ChunkReader {
	#reading: boolean = false;
	#chunkIndex: number = 0;

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
				await onRead?.(chunk, this.#chunkIndex);
				this.#chunkIndex++;
			}
			await read();
		};
		await read();
		this.#chunkIndex = 0;
	}

	stop() {
		this.#reading = false;
	}
}
