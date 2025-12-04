import z from "zod";
import type { CustomEventTarget } from "./events";
import {
	ClientSchema,
	SessionSchema,
	type Client,
	type Session,
} from "./session";

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

type CustomMessageEvent<T> = CustomEvent<{ type: SocketMessageType } & T>;

export type MessageEventMap = {
	[MessageType.Error]: CustomMessageEvent<{ payload: string }>;
	[MessageType.Identity]: CustomMessageEvent<{ payload: Client }>;
	[MessageType.SessionInfo]: CustomMessageEvent<{ payload: Session }>;
	[MessageType.SessionCreated]: CustomMessageEvent<{
		payload: { session_id: string };
	}>;
	[MessageType.SessionJoined]: CustomMessageEvent<{ payload: Session }>;
	[MessageType.SessionLeft]: CustomMessageEvent<{ payload: Session }>;
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

export function isMessageType(input: unknown): input is SocketMessageType {
	if (typeof input !== "string") {
		return false;
	}
	return Object.values(MessageType).some((v) => v === input);
}

// Validation

export const ErrorSchema = z.object({
	type: z.literal(MessageType.Error),
	payload: z.string(),
});

export const IdentitySchema = z.object({
	type: z.literal(MessageType.Identity),
	payload: ClientSchema,
});

export const SessionInfoSchema = z.object({
	type: z.literal(MessageType.SessionInfo),
	payload: SessionSchema,
});

export const SessionCreatedSchema = z.object({
	type: z.literal(MessageType.SessionCreated),
	payload: z.object({ session_id: z.string() }),
});

export const SessionJoinedSchema = z.object({
	type: z.literal(MessageType.SessionJoined),
	payload: SessionSchema,
});

export const SessionLeftSchema = z.object({
	type: z.literal(MessageType.SessionLeft),
	payload: SessionSchema,
});
