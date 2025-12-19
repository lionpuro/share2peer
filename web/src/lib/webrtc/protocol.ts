export const PACKET_SIZE = 16 * 1024;
export const FILE_ID_SIZE = 16;
export const CHUNK_INDEX_SIZE = 4;
export const CHUNK_DATA_SIZE = PACKET_SIZE - FILE_ID_SIZE - CHUNK_INDEX_SIZE;

export type Chunk = {
	fileID: string;
	index: number;
	data: Uint8Array;
};

/**
 * Creates a binary packet with the following structure:
 * 16 bytes: file id
 * 4 bytes: chunk index
 * n bytes: chunk data
 */
export function encodeChunk(chunk: Chunk): ArrayBuffer {
	const { fileID, index, data } = chunk;
	const id = encodeID(fileID);

	const buf = new ArrayBuffer(
		FILE_ID_SIZE + CHUNK_INDEX_SIZE + data.byteLength,
	);

	const uint8 = new Uint8Array(buf);
	uint8.set(id, 0);

	const uint32 = new Uint32Array(buf, FILE_ID_SIZE, 1);
	uint32[0] = index;

	uint8.set(data, FILE_ID_SIZE + CHUNK_INDEX_SIZE);

	return buf;
}

export function decodeChunk(buf: ArrayBuffer): Chunk {
	const id = new Uint8Array(buf, 0, FILE_ID_SIZE);
	const fileID = decodeID(id);
	const index = new Uint32Array(buf, FILE_ID_SIZE, 1)[0];
	const data = new Uint8Array(buf, FILE_ID_SIZE + CHUNK_INDEX_SIZE);
	const chunk: Chunk = {
		fileID: fileID,
		index: index,
		data: data,
	};
	return chunk;
}

const nanoidChars =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

export function encodeID(id: string): Uint8Array {
	/**
	 * nanoid has 21 chars, but we can compress it to 16 bytes because of the
	 * limited alphabet.
	 */
	if (id.length !== 21) {
		throw new Error("id must be 21 characters");
	}
	const value = new Uint8Array(FILE_ID_SIZE);
	let bitBuffer = 0;
	let bitsInBuffer = 0;
	let byteIndex = 0;
	for (let i = 0; i < 21; i++) {
		const charValue = nanoidChars.indexOf(id[i]);
		bitBuffer = (bitBuffer << 6) | charValue;
		bitsInBuffer += 6;
		while (bitsInBuffer >= 8) {
			bitsInBuffer -= 8;
			value[byteIndex++] = (bitBuffer >> bitsInBuffer) & 0xff;
		}
	}
	if (bitsInBuffer > 0) {
		value[byteIndex] = (bitBuffer << (8 - bitsInBuffer)) & 0xff;
	}
	return value;
}

export function decodeID(buffer: Uint8Array): string {
	if (buffer.byteLength !== FILE_ID_SIZE) {
		throw new Error("incorrect input byte length");
	}
	const value = buffer.subarray(0, FILE_ID_SIZE);
	let bitBuffer = 0;
	let bitsInBuffer = 0;
	let id = "";
	for (let i = 0; i < FILE_ID_SIZE; i++) {
		bitBuffer = (bitBuffer << 8) | value[i];
		bitsInBuffer += 8;
		while (bitsInBuffer >= 6) {
			bitsInBuffer -= 6;
			const charValue = (bitBuffer >> bitsInBuffer) & 0x3f;
			id += nanoidChars[charValue];
		}
	}
	if (id.length !== 21) {
		throw new Error("failed to decode id");
	}
	return id;
}
