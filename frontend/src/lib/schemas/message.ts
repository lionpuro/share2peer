import * as z from "zod/mini";
import { ErrorPayloadSchema } from "./error";
import { SessionSchema } from "./session";
import { ClientSchema } from "./client";

const types = {
	error: "error",
	identity: "identity",
	sessionNotFound: "session-not-found",
	sessionInfo: "session-info",
	joinSession: "join-session",
	leaveSession: "leave-session",
	requestSession: "request-session",
	sessionCreated: "session-created",
	sessionJoined: "session-joined",
	sessionLeft: "session-left",
	clientJoined: "client-joined",
	clientLeft: "client-left",
	offer: "offer",
	answer: "answer",
	iceCandidate: "ice-candidate",
} as const;

export type MessageEventMap = {
	[K in keyof typeof incomingSchemas]: CustomEvent<
		z.infer<(typeof incomingSchemas)[K]>
	>;
};

export class ServerMessageEvent<
	T extends IncomingMessage,
> extends CustomEvent<T> {
	constructor(type: T["type"], detail: T) {
		super(type, { detail: detail });
	}
}

export type MessageEventListener<T extends keyof MessageEventMap> = (
	e: MessageEventMap[T],
) => void;

export const ErrorSchema = z.object({
	type: z.literal(types.error),
	payload: ErrorPayloadSchema,
});

export type ErrorMessage = z.infer<typeof ErrorSchema>;

export const IdentitySchema = z.object({
	type: z.literal(types.identity),
	payload: ClientSchema,
});

export type IdentityMessage = z.infer<typeof IdentitySchema>;

export const SessionNotFoundSchema = z.object({
	type: z.literal(types.sessionNotFound),
	payload: z.object({ session_id: z.string() }),
});

export type SessionNotFoundMessage = z.infer<typeof SessionNotFoundSchema>;

export const SessionInfoSchema = z.object({
	type: z.literal(types.sessionInfo),
	payload: SessionSchema,
});

export type SessionInfoMessage = z.infer<typeof SessionInfoSchema>;

export const SessionCreatedSchema = z.object({
	type: z.literal(types.sessionCreated),
	payload: SessionSchema,
});

export type SessionCreatedMessage = z.infer<typeof SessionCreatedSchema>;

export const SessionJoinedSchema = z.object({
	type: z.literal(types.sessionJoined),
	payload: SessionSchema,
});

export type SessionJoinedMessage = z.infer<typeof SessionJoinedSchema>;

export const SessionLeftSchema = z.object({
	type: z.literal(types.sessionLeft),
	payload: SessionSchema,
});

export type SessionLeftMessage = z.infer<typeof SessionLeftSchema>;

export const ClientJoinedSchema = z.object({
	type: z.literal(types.clientJoined),
	payload: ClientSchema,
});

export type ClientJoinedMessage = z.infer<typeof ClientJoinedSchema>;

export const ClientLeftSchema = z.object({
	type: z.literal(types.clientLeft),
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
	type: z.literal(types.offer),
	payload: z.object({
		session_id: z.string(),
		offer: RTCSessionDescriptionInitSchema,
		from: z.string(),
		to: z.string(),
	}),
});

export type OfferMessage = z.infer<typeof OfferSchema>;

export const AnswerSchema = z.object({
	type: z.literal(types.answer),
	payload: z.object({
		session_id: z.string(),
		answer: RTCSessionDescriptionInitSchema,
		from: z.string(),
		to: z.string(),
	}),
});

export type AnswerMessage = z.infer<typeof AnswerSchema>;

export const ICECandidateSchema = z.object({
	type: z.literal(types.iceCandidate),
	payload: z.object({
		session_id: z.string(),
		candidate: RTCIceCandidateSchema,
		from: z.string(),
		to: z.string(),
	}),
});

type SessionIDPayload = {
	session_id: string;
};

type JoinSessionMessage = {
	type: "join-session";
	payload: SessionIDPayload;
};

type LeaveSessionMessage = {
	type: "leave-session";
	payload: SessionIDPayload;
};

type RequestSessionMessage = {
	type: "request-session";
};

const rtcSchemas = {
	[types.offer]: OfferSchema,
	[types.answer]: AnswerSchema,
	[types.iceCandidate]: ICECandidateSchema,
};

const incomingSchemas = {
	[types.error]: ErrorSchema,
	[types.identity]: IdentitySchema,
	[types.sessionNotFound]: SessionNotFoundSchema,
	[types.sessionInfo]: SessionInfoSchema,
	[types.sessionCreated]: SessionCreatedSchema,
	[types.sessionJoined]: SessionJoinedSchema,
	[types.sessionLeft]: SessionLeftSchema,
	[types.clientJoined]: ClientJoinedSchema,
	[types.clientLeft]: ClientLeftSchema,
	...rtcSchemas,
};

type RTCMessageType = keyof typeof rtcSchemas;
type RTCMessage = z.infer<(typeof rtcSchemas)[RTCMessageType]>;

type IncomingMessageType = keyof typeof incomingSchemas;
type IncomingMessage = z.infer<(typeof incomingSchemas)[IncomingMessageType]>;

export type OutgoingMessageType =
	| RTCMessageType
	| "join-session"
	| "leave-session"
	| "request-session";
export type OutgoingMessage =
	| RTCMessage
	| JoinSessionMessage
	| LeaveSessionMessage
	| RequestSessionMessage;

function isIncomingMessageType(input: unknown): input is IncomingMessageType {
	if (typeof input !== "string") {
		return false;
	}
	return input in incomingSchemas;
}

export function parseMessage(msg: unknown): IncomingMessage {
	if (
		!msg ||
		typeof msg !== "object" ||
		!("type" in msg) ||
		!("payload" in msg)
	) {
		throw new Error("invalid message schema");
	}
	if (!isIncomingMessageType(msg.type)) {
		throw new Error("invalid message type: " + msg.type);
	}
	return incomingSchemas[msg.type].parse(msg);
}
