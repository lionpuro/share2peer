import * as z from "zod/mini";

export const ErrorCodes = {
	ServerError: "SERVER_ERROR",
	SessionNotFound: "SESSION_NOT_FOUND",
	SessionFull: "SESSION_FULL",
} as const;

export const ErrorCodeSchema = z.union([
	z.literal(ErrorCodes.ServerError),
	z.literal(ErrorCodes.SessionNotFound),
	z.literal(ErrorCodes.SessionFull),
]);

export const ErrorPayloadSchema = z.object({
	code: ErrorCodeSchema,
	message: z.string(),
});

export type ErrorPayload = z.infer<typeof ErrorPayloadSchema>;
