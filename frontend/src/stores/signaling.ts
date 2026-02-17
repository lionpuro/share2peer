import { atom } from "nanostores";
import type { Client, Session } from "#/lib/schemas";

type ConnectionState = "closed" | "connecting" | "open" | "error";

export const $connectionState = atom<ConnectionState>("closed");

export const $identity = atom<Client | null>(null);

export const $session = atom<Session | null>(null);
