import * as z from "zod/mini";

export const ErrorCodes = {
	ServerError: "SERVER_ERROR",
	NotFound: "NOT_FOUND",
} as const;

export const ErrorCodeSchema = z.union([
	z.literal(ErrorCodes.ServerError),
	z.literal(ErrorCodes.NotFound),
]);

export const ErrorPayloadSchema = z.object({
	code: ErrorCodeSchema,
	message: z.string(),
});

export type ErrorPayload = z.infer<typeof ErrorPayloadSchema>;
