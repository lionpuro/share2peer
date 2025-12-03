import type { CustomEventTarget } from "./events";
import type { Client, Session } from "./session";

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
