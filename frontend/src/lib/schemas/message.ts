import * as z from "zod/mini";
import { ErrorPayloadSchema } from "./error";
import { SessionSchema } from "./session";
import { ClientSchema } from "./client";

export const MessageType = {
	Error: "error",
	Identity: "identity",
	SessionNotFound: "session-not-found",
	SessionInfo: "session-info",
	JoinSession: "join-session",
	LeaveSession: "leave-session",
	RequestSession: "request-session",
	SessionCreated: "session-created",
	SessionJoined: "session-joined",
	SessionLeft: "session-left",
	ClientJoined: "client-joined",
	ClientLeft: "client-left",
	Offer: "offer",
	Answer: "answer",
	ICECandidate: "ice-candidate",
} as const;

export type SocketMessageType = (typeof MessageType)[keyof typeof MessageType];

export type Message<T = unknown> = {
	type: SocketMessageType;
	payload?: T;
};

export type MessageEventMap = {
	[MessageType.Error]: CustomEvent<ErrorMessage>;
	[MessageType.Identity]: CustomEvent<IdentityMessage>;
	[MessageType.SessionNotFound]: CustomEvent<SessionNotFoundMessage>;
	[MessageType.SessionInfo]: CustomEvent<SessionInfoMessage>;
	[MessageType.SessionCreated]: CustomEvent<SessionCreatedMessage>;
	[MessageType.SessionJoined]: CustomEvent<SessionJoinedMessage>;
	[MessageType.SessionLeft]: CustomEvent<SessionLeftMessage>;
	[MessageType.ClientJoined]: CustomEvent<ClientJoinedMessage>;
	[MessageType.ClientLeft]: CustomEvent<ClientLeftMessage>;
	[MessageType.Offer]: CustomEvent<OfferMessage>;
	[MessageType.Answer]: CustomEvent<AnswerMessage>;
	[MessageType.ICECandidate]: CustomEvent<ICECandidateMessage>;
};

export class SocketMessageEvent<
	T = MessageEventMap[keyof MessageEventMap],
> extends CustomEvent<T> {
	constructor(type: SocketMessageType, detail: T) {
		super(type, { detail: detail });
	}
}

export type MessageEventListener<T extends keyof MessageEventMap> = (
	e: MessageEventMap[T],
) => void;

export const ErrorSchema = z.object({
	type: z.literal(MessageType.Error),
	payload: ErrorPayloadSchema,
});

export type ErrorMessage = z.infer<typeof ErrorSchema>;

export const IdentitySchema = z.object({
	type: z.literal(MessageType.Identity),
	payload: ClientSchema,
});

export type IdentityMessage = z.infer<typeof IdentitySchema>;

export const SessionNotFoundSchema = z.object({
	type: z.literal(MessageType.SessionNotFound),
	payload: z.object({ session_id: z.string() }),
});

export type SessionNotFoundMessage = z.infer<typeof SessionNotFoundSchema>;

export const SessionInfoSchema = z.object({
	type: z.literal(MessageType.SessionInfo),
	payload: SessionSchema,
});

export type SessionInfoMessage = z.infer<typeof SessionInfoSchema>;

export const SessionCreatedSchema = z.object({
	type: z.literal(MessageType.SessionCreated),
	payload: SessionSchema,
});

export type SessionCreatedMessage = z.infer<typeof SessionCreatedSchema>;

export const SessionJoinedSchema = z.object({
	type: z.literal(MessageType.SessionJoined),
	payload: SessionSchema,
});

export type SessionJoinedMessage = z.infer<typeof SessionJoinedSchema>;

export const SessionLeftSchema = z.object({
	type: z.literal(MessageType.SessionLeft),
	payload: SessionSchema,
});

export type SessionLeftMessage = z.infer<typeof SessionLeftSchema>;

export const ClientJoinedSchema = z.object({
	type: z.literal(MessageType.ClientJoined),
	payload: ClientSchema,
});

export type ClientJoinedMessage = z.infer<typeof ClientJoinedSchema>;

export const ClientLeftSchema = z.object({
	type: z.literal(MessageType.ClientLeft),
	payload: ClientSchema,
});

export type ClientLeftMessage = z.infer<typeof ClientLeftSchema>;

export const RTCSessionDescriptionInitSchema = z.object({
	type: z.union([
		z.literal("answer"),
		z.literal("offer"),
		z.literal("pranswer"),
		z.literal("rollback"),
	]),
	sdp: z.optional(z.string()),
});

export const RTCIceCandidateSchema = z.object({
	candidate: z.optional(z.string()),
	sdpMid: z.optional(z.union([z.string(), z.null()])),
	sdpMLineIndex: z.optional(z.union([z.number(), z.null()])),
	usernameFragment: z.optional(z.union([z.string(), z.null()])),
});

export type ICECandidateMessage = z.infer<typeof ICECandidateSchema>;

export const OfferSchema = z.object({
	type: z.literal(MessageType.Offer),
	payload: z.object({
		session_id: z.string(),
		offer: RTCSessionDescriptionInitSchema,
		from: z.string(),
		to: z.string(),
	}),
});

export type OfferMessage = z.infer<typeof OfferSchema>;

export const AnswerSchema = z.object({
	type: z.literal(MessageType.Answer),
	payload: z.object({
		session_id: z.string(),
		answer: RTCSessionDescriptionInitSchema,
		from: z.string(),
		to: z.string(),
	}),
});

export type AnswerMessage = z.infer<typeof AnswerSchema>;

export const ICECandidateSchema = z.object({
	type: z.literal(MessageType.ICECandidate),
	payload: z.object({
		session_id: z.string(),
		candidate: RTCIceCandidateSchema,
		from: z.string(),
		to: z.string(),
	}),
});

export function isMessageType(input: unknown): input is SocketMessageType {
	if (typeof input !== "string") {
		return false;
	}
	return Object.values(MessageType).some((v) => v === input);
}

export function parseMessage(msg: unknown) {
	if (
		!msg ||
		typeof msg !== "object" ||
		!("type" in msg) ||
		!("payload" in msg)
	) {
		throw new Error("invalid message");
	}
	if (!isMessageType(msg.type)) {
		throw new Error("unknown message type: " + msg.type);
	}
	switch (msg.type) {
		case MessageType.Error:
			return ErrorSchema.parse(msg);
		case MessageType.Identity:
			return IdentitySchema.parse(msg);
		case MessageType.Offer:
			return OfferSchema.parse(msg);
		case MessageType.Answer:
			return AnswerSchema.parse(msg);
		case MessageType.ICECandidate:
			return ICECandidateSchema.parse(msg);
		case MessageType.SessionNotFound:
			return SessionNotFoundSchema.parse(msg);
		case MessageType.SessionInfo:
			return SessionInfoSchema.parse(msg);
		case MessageType.SessionCreated:
			return SessionCreatedSchema.parse(msg);
		case MessageType.SessionJoined:
			return SessionJoinedSchema.parse(msg);
		case MessageType.SessionLeft:
			return SessionLeftSchema.parse(msg);
		case MessageType.ClientJoined:
			return ClientJoinedSchema.parse(msg);
		case MessageType.ClientLeft:
			return ClientLeftSchema.parse(msg);
		default:
			throw new Error("invalid message type: " + msg.type);
	}
}
