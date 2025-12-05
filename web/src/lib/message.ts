import * as z from "zod/mini";
import type { CustomEventTarget } from "./events";
import { ClientSchema, SessionSchema } from "./session";

export const MessageType = {
	Error: "error",
	Identity: "identity",
	// Sessions
	SessionInfo: "session-info",
	JoinSession: "join-session",
	LeaveSession: "leave-session",
	RequestSession: "request-session",
	SessionCreated: "session-created",
	SessionJoined: "session-joined",
	SessionLeft: "session-left",
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

export function isMessageType(input: unknown): input is SocketMessageType {
	if (typeof input !== "string") {
		return false;
	}
	return Object.values(MessageType).some((v) => v === input);
}
