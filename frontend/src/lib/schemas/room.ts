import * as z from "zod/mini";
import { ClientSchema } from "./client";

export const RoomSchema = z.object({
	id: z.string(),
	host: z.optional(z.string()),
	clients: z.optional(z.union([z.array(ClientSchema), z.null()])),
});

export type Room = z.infer<typeof RoomSchema>;

export const RoomIDSchema = z.object({
	room_id: z.string(),
});
