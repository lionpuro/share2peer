import * as z from "zod/mini";
import { ErrorPayloadSchema } from "./error";
import { RoomIDSchema, RoomSchema } from "./room";
import { UserSchema } from "./user";

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
const ROOM_INFO = "room-info";
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

type OutgoingBodyMap = {
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

export type OutgoingMessageBody = OutgoingBodyMap[keyof OutgoingBodyMap];

export const incomingBodySchemas = {
	[ERROR]: body(ERROR, ErrorPayloadSchema),
	[IDENTITY]: body(IDENTITY, UserSchema),
	[ROOM_INFO]: body(ROOM_INFO, RoomSchema),
	[USER_JOINED]: body(USER_JOINED, UserSchema),
	[USER_LEFT]: body(USER_LEFT, UserSchema),
	[ROOM_CREATED]: body(ROOM_CREATED, RoomSchema),
	[ROOM_JOINED]: body(ROOM_JOINED, RoomSchema),
	[ROOM_LEFT]: body(ROOM_LEFT, RoomSchema),
	[OFFER]: body(OFFER, OfferSchema),
	[ANSWER]: body(ANSWER, AnswerSchema),
	[ICE_CANDIDATE]: body(ICE_CANDIDATE, CandidateSchema),
	[NETWORK_USERS]: body(NETWORK_USERS, NetworkUsersSchema),
	[ROOM_INVITATION]: body(ROOM_INVITATION, RoomInvitationSchema),
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
