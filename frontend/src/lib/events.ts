export type CustomEventTarget<EventMap extends object> = {
	new (): IntermediateEventTarget<EventMap>;
};

interface IntermediateEventTarget<EventMap> extends EventTarget {
	addEventListener<K extends keyof EventMap>(
		type: K,
		callback: (
			event: EventMap[K] extends Event ? EventMap[K] : never,
		) => EventMap[K] extends Event ? void : never,
		options?: boolean | AddEventListenerOptions,
	): void;

	addEventListener(
		type: string,
		callback: EventListenerOrEventListenerObject | null,
		options?: EventListenerOptions | boolean,
	): void;

	removeEventListener<K extends keyof EventMap>(
		type: K,
		callback: (
			event: EventMap[K] extends Event ? EventMap[K] : never,
		) => EventMap[K] extends Event ? void : never,
		options?: EventListenerOptions | boolean,
	): void;

	removeEventListener(
		type: string,
		callback: EventListenerOrEventListenerObject | null,
		options?: EventListenerOptions | boolean,
	): void;
}
