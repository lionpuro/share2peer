import * as z from "zod/mini";
import { UserSchema } from "./user";

export const RoomSchema = z.object({
	id: z.string(),
	users: z.optional(z.union([z.array(UserSchema), z.null()])),
});

export type Room = z.infer<typeof RoomSchema>;

export const RoomIDSchema = z.object({
	room_id: z.string(),
});
