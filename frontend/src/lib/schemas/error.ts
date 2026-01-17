import * as z from "zod/mini";

export const ErrorCodes = {
	ServerError: "SERVER_ERROR",
} as const;

export const ErrorCodeSchema = z.union([z.literal(ErrorCodes.ServerError)]);

export const ErrorPayloadSchema = z.object({
	code: ErrorCodeSchema,
	message: z.string(),
});

export type ErrorPayload = z.infer<typeof ErrorPayloadSchema>;
