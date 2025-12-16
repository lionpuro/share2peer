import { FILE_ID_SIZE } from "../constants";
import type { Chunk } from "./file";

export function encodeChunk(chunk: Chunk): Uint8Array<ArrayBuffer> {
	const { fileID, data } = chunk;
	const id = encodeID(fileID);
	const result = new Uint8Array(id.byteLength + data.byteLength);
	result.set(id, 0);
	result.set(data, id.byteLength);
	return result;
}

export function decodeChunk(uint8: Uint8Array): Chunk {
	const id = uint8.subarray(0, FILE_ID_SIZE);
	const fileID = decodeID(id);
	const data = uint8.subarray(FILE_ID_SIZE);
	const chunk: Chunk = {
		fileID: fileID,
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
