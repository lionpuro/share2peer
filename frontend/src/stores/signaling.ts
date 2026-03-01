import { atom } from "nanostores";
import type { Client, Room } from "#/lib/schemas";

type ConnectionState = "closed" | "connecting" | "open" | "error";

export const $connectionState = atom<ConnectionState>("closed");

export const $identity = atom<Client | undefined>();

export const $room = atom<Room | undefined>();
