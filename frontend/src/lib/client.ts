import * as z from "zod/mini";

const DeviceTypeSchema = z.union([
	z.literal("desktop"),
	z.literal("tablet"),
	z.literal("mobile"),
	z.literal("unknown"),
]);

export type DeviceType = z.infer<typeof DeviceTypeSchema>;

export const ClientSchema = z.object({
	id: z.string(),
	device_type: DeviceTypeSchema,
	device_name: z.string(),
});

export type Client = z.infer<typeof ClientSchema>;
