import * as z from "zod/mini";
import { ClientSchema } from "./client";

export const SessionSchema = z.object({
	id: z.string(),
	host: z.optional(z.string()),
	clients: z.optional(z.union([z.array(ClientSchema), z.null()])),
});

export type Session = z.infer<typeof SessionSchema>;
