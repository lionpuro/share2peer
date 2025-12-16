const KB = 1024;

export const MESSAGE_SIZE = 16 * KB;
export const FILE_ID_SIZE = 16; // 16 bytes
export const CHUNK_DATA_SIZE = MESSAGE_SIZE - FILE_ID_SIZE;
