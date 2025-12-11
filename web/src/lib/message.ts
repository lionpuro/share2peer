import * as z from "zod/mini";
import type { CustomEventTarget } from "./events";
import { ClientSchema, SessionSchema } from "./session";
import {
	RTCIceCandidateSchema,
	RTCSessionDescriptionInitSchema,
} from "./webrtc";

export const MessageType = {
	Error: "error",
	Identity: "identity",
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

export type SocketMessageEventTarget = CustomEventTarget<MessageEventMap>;

export type MessageEventListener<T extends keyof MessageEventMap> = (
	e: MessageEventMap[T],
) => void;

export const ErrorSchema = z.object({
	type: z.literal(MessageType.Error),
	payload: z.string(),
});

export type ErrorMessage = z.infer<typeof ErrorSchema>;

export const IdentitySchema = z.object({
	type: z.literal(MessageType.Identity),
	payload: ClientSchema,
});

export type IdentityMessage = z.infer<typeof IdentitySchema>;

export const SessionInfoSchema = z.object({
	type: z.literal(MessageType.SessionInfo),
	payload: SessionSchema,
});

export type SessionInfoMessage = z.infer<typeof SessionInfoSchema>;

export const SessionCreatedSchema = z.object({
	type: z.literal(MessageType.SessionCreated),
	payload: z.object({ session_id: z.string() }),
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

export type ICECandidateMessage = z.infer<typeof ICECandidateSchema>;

export function isMessageType(input: unknown): input is SocketMessageType {
	if (typeof input !== "string") {
		return false;
	}
	return Object.values(MessageType).some((v) => v === input);
}
