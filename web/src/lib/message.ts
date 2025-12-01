export const MessageType = {
	Error: "error",
	Identity: "identity",
	// Sessions
	SessionInfo: "session-info",
	JoinSession: "join-session",
	RequestSession: "request-session",
	SessionCreated: "session-created",
	SessionJoined: "session-joined",
} as const;

export type WebSocketMessageType =
	(typeof MessageType)[keyof typeof MessageType];

export type Message<T = unknown> = {
	type: WebSocketMessageType;
	payload?: T;
};
