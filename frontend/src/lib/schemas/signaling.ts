import * as z from "zod/mini";
import { ErrorPayloadSchema } from "./error";
import { SessionIDSchema, SessionSchema } from "./session";
import { ClientSchema } from "./client";

export const MessageSchema = z.object({
	type: z.union([
		z.literal("message"),
		z.literal("request"),
		z.literal("response"),
	]),
	transaction: z.optional(z.string()),
	body: z.unknown(),
});

export function parseMessage(input: unknown) {
	if (typeof input !== "string") {
		throw new Error("raw message is not json");
	}
	const message = JSON.parse(input) as unknown;
	return MessageSchema.parse(message);
}

export type Message = z.infer<typeof MessageSchema>;

export type OutgoingMessage = Message & { body: OutgoingMessageBody };

export type IncomingMessage = Message & { body: IncomingMessageBody };

function body<T extends string, P extends z.ZodMiniType>(type: T, payload: P) {
	return z.object({
		type: z.literal(type),
		payload: payload,
	});
}

const ERROR = "error";
const IDENTITY = "identity";
const SESSION_INFO = "session-info";
const SESSION_NOT_FOUND = "session-not-found";
const CLIENT_JOINED = "client-joined";
const CLIENT_LEFT = "client-left";
const OFFER = "offer";
const ANSWER = "answer";
const ICE_CANDIDATE = "ice-candidate";
const SESSION_CREATED = "session-created";
const SESSION_JOINED = "session-joined";
const SESSION_LEFT = "session-left";
const REQUEST_SESSION = "request-session";
const JOIN_SESSION = "join-session";
const LEAVE_SESSION = "leave-session";

export const RequestResponseMap = {
	[REQUEST_SESSION]: SESSION_CREATED,
	[JOIN_SESSION]: SESSION_JOINED,
	[LEAVE_SESSION]: SESSION_LEFT,
} as const;

export type RequestType = keyof typeof RequestResponseMap;
export type ResponseType =
	(typeof RequestResponseMap)[keyof typeof RequestResponseMap];

const RTCSessionDescriptionInitSchema = z.object({
	type: z.union([
		z.literal("answer"),
		z.literal("offer"),
		z.literal("pranswer"),
		z.literal("rollback"),
	]),
	sdp: z.optional(z.string()),
});

const OfferSchema = z.object({
	session_id: z.string(),
	offer: RTCSessionDescriptionInitSchema,
	from: z.string(),
	to: z.string(),
});

const AnswerSchema = z.object({
	session_id: z.string(),
	answer: RTCSessionDescriptionInitSchema,
	from: z.string(),
	to: z.string(),
});

const CandidateSchema = z.object({
	session_id: z.string(),
	candidate: z.object({
		candidate: z.optional(z.string()),
		sdpMid: z.optional(z.union([z.string(), z.null()])),
		sdpMLineIndex: z.optional(z.union([z.number(), z.null()])),
		usernameFragment: z.optional(z.union([z.string(), z.null()])),
	}),
	from: z.string(),
	to: z.string(),
});

type OutgoingBodyMap = {
	[REQUEST_SESSION]: { type: typeof REQUEST_SESSION };
	[JOIN_SESSION]: {
		type: typeof JOIN_SESSION;
		payload: z.infer<typeof SessionIDSchema>;
	};
	[LEAVE_SESSION]: {
		type: typeof LEAVE_SESSION;
		payload: z.infer<typeof SessionIDSchema>;
	};
	[OFFER]: { type: typeof OFFER; payload: z.infer<typeof OfferSchema> };
	[ANSWER]: { type: typeof ANSWER; payload: z.infer<typeof AnswerSchema> };
	[ICE_CANDIDATE]: {
		type: typeof ICE_CANDIDATE;
		payload: z.infer<typeof CandidateSchema>;
	};
};

export type OutgoingMessageBody = OutgoingBodyMap[keyof OutgoingBodyMap];

export const incomingBodySchemas = {
	[ERROR]: body(ERROR, ErrorPayloadSchema),
	[IDENTITY]: body(IDENTITY, ClientSchema),
	[SESSION_INFO]: body(SESSION_INFO, SessionSchema),
	[SESSION_NOT_FOUND]: body(SESSION_NOT_FOUND, SessionIDSchema),
	[CLIENT_JOINED]: body(CLIENT_JOINED, ClientSchema),
	[CLIENT_LEFT]: body(CLIENT_LEFT, ClientSchema),
	[SESSION_CREATED]: body(SESSION_CREATED, SessionSchema),
	[SESSION_JOINED]: body(SESSION_JOINED, SessionSchema),
	[SESSION_LEFT]: body(SESSION_LEFT, SessionSchema),
	[OFFER]: body(OFFER, OfferSchema),
	[ANSWER]: body(ANSWER, AnswerSchema),
	[ICE_CANDIDATE]: body(ICE_CANDIDATE, CandidateSchema),
} as const;

export type IncomingMessageBody = z.infer<
	(typeof incomingBodySchemas)[keyof typeof incomingBodySchemas]
>;

export function parseBody(input: unknown): IncomingMessageBody {
	if (
		input === null ||
		typeof input !== "object" ||
		!("type" in input) ||
		typeof input.type !== "string" ||
		!("payload" in input)
	) {
		throw new Error("invalid message format");
	}
	if (!isMessageType(input.type)) {
		throw new Error("invalid message type");
	}
	return incomingBodySchemas[input.type].parse(input);
}

function isMessageType(
	input: unknown,
): input is keyof typeof incomingBodySchemas {
	return typeof input === "string" && input in incomingBodySchemas;
}
