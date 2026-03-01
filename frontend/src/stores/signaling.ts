import { atom, map } from "nanostores";
import type { Client, Room } from "#/lib/schemas";

type ConnectionState = "disconnected" | "connecting" | "connected" | "failed";

export const $connectionState = atom<ConnectionState>("disconnected");

export const $identity = atom<Client | undefined>();

export const $room = atom<Room | undefined>();
