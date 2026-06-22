import * as z from "zod/mini";
import { ErrorPayloadSchema } from "./error";
import { RoomIDSchema, RoomSchema } from "./room";
import { UserSchema } from "./user";

export type RawMessage = {
	transaction?: string;
	type: string;
	payload?: unknown;
};

function message<T extends string, P extends z.ZodMiniType>(
	type: T,
	payload: P,
) {
	return z.object({
		transaction: z.optional(z.string()),
		type: z.literal(type),
		payload: payload,
	});
}

const PING = "ping";
const ERROR = "error";
const REGISTER = "register";
const IDENTITY = "identity";
const ROOM_STATE = "room-state";
const USER_JOINED = "user-joined";
const USER_LEFT = "user-left";
const OFFER = "offer";
const ANSWER = "answer";
const ICE_CANDIDATE = "ice-candidate";
const ROOM_CREATED = "room-created";
const ROOM_JOINED = "room-joined";
const ROOM_LEFT = "room-left";
const CREATE_ROOM = "create-room";
const JOIN_ROOM = "join-room";
const LEAVE_ROOM = "leave-room";
const NETWORK_USERS = "network-users";
const INVITE_TO_ROOM = "invite-to-room";
const ROOM_INVITATION = "room-invitation";

export const RequestResponseMap = {
	[CREATE_ROOM]: ROOM_CREATED,
	[JOIN_ROOM]: ROOM_JOINED,
	[LEAVE_ROOM]: ROOM_LEFT,
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
	room_id: z.string(),
	offer: RTCSessionDescriptionInitSchema,
	from: z.string(),
	to: z.string(),
});

const AnswerSchema = z.object({
	room_id: z.string(),
	answer: RTCSessionDescriptionInitSchema,
	from: z.string(),
	to: z.string(),
});

const CandidateSchema = z.object({
	room_id: z.string(),
	candidate: z.object({
		candidate: z.optional(z.string()),
		sdpMid: z.optional(z.union([z.string(), z.null()])),
		sdpMLineIndex: z.optional(z.union([z.number(), z.null()])),
		usernameFragment: z.optional(z.union([z.string(), z.null()])),
	}),
	from: z.string(),
	to: z.string(),
});

const NetworkUsersSchema = z.object({
	users: z.array(UserSchema),
});

const RoomInvitationSchema = z.object({
	from: UserSchema,
	room_id: z.string(),
});

type OutgoingMessageMap = {
	[PING]: { type: typeof PING };
	[REGISTER]: { type: typeof REGISTER; payload: { username?: string } };
	[CREATE_ROOM]: { type: typeof CREATE_ROOM };
	[JOIN_ROOM]: {
		type: typeof JOIN_ROOM;
		payload: z.infer<typeof RoomIDSchema>;
	};
	[LEAVE_ROOM]: {
		type: typeof LEAVE_ROOM;
		payload: z.infer<typeof RoomIDSchema>;
	};
	[OFFER]: { type: typeof OFFER; payload: z.infer<typeof OfferSchema> };
	[ANSWER]: { type: typeof ANSWER; payload: z.infer<typeof AnswerSchema> };
	[ICE_CANDIDATE]: {
		type: typeof ICE_CANDIDATE;
		payload: z.infer<typeof CandidateSchema>;
	};
	[INVITE_TO_ROOM]: {
		type: typeof INVITE_TO_ROOM;
		payload: { user_id: string; room_id: string };
	};
};

export type OutgoingMessage = RawMessage &
	OutgoingMessageMap[keyof OutgoingMessageMap];

export const incomingMessageSchemas = {
	[ERROR]: message(ERROR, ErrorPayloadSchema),
	[IDENTITY]: message(IDENTITY, UserSchema),
	[ROOM_STATE]: message(ROOM_STATE, RoomSchema),
	[USER_JOINED]: message(USER_JOINED, UserSchema),
	[USER_LEFT]: message(USER_LEFT, UserSchema),
	[ROOM_CREATED]: message(ROOM_CREATED, RoomSchema),
	[ROOM_JOINED]: message(ROOM_JOINED, RoomSchema),
	[ROOM_LEFT]: message(ROOM_LEFT, RoomSchema),
	[OFFER]: message(OFFER, OfferSchema),
	[ANSWER]: message(ANSWER, AnswerSchema),
	[ICE_CANDIDATE]: message(ICE_CANDIDATE, CandidateSchema),
	[NETWORK_USERS]: message(NETWORK_USERS, NetworkUsersSchema),
	[ROOM_INVITATION]: message(ROOM_INVITATION, RoomInvitationSchema),
} as const;

type IncomingMessageMap = {
	[K in keyof typeof incomingMessageSchemas]: z.infer<
		(typeof incomingMessageSchemas)[K]
	>;
};

export type IncomingMessage<
	K extends keyof IncomingMessageMap = keyof IncomingMessageMap,
> = IncomingMessageMap[K];

export function parseMessage(input: unknown): IncomingMessage {
	if (typeof input !== "string") {
		throw new Error("input is not json");
	}
	const parsed = JSON.parse(input) as unknown;
	if (
		parsed === null ||
		typeof parsed !== "object" ||
		!("type" in parsed) ||
		typeof parsed.type !== "string" ||
		!("payload" in parsed)
	) {
		throw new Error("invalid message format");
	}
	if (!isMessageType(parsed.type)) {
		throw new Error("invalid message type");
	}
	return incomingMessageSchemas[parsed.type].parse(parsed);
}

function isMessageType(
	input: unknown,
): input is keyof typeof incomingMessageSchemas {
	return typeof input === "string" && input in incomingMessageSchemas;
}
