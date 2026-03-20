import { atom } from "nanostores";
import type { User, Room } from "#/lib/schemas";

type ConnectionState = "disconnected" | "connecting" | "connected" | "failed";

export const $connectionState = atom<ConnectionState>("disconnected");

export const $identity = atom<User | undefined>();

export const $networkUsers = atom<User[]>([]);

export const $room = atom<Room | undefined>();
