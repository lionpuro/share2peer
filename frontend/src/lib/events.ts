type EventCallback<T> = (payload: T) => void;

export class EventEmitter<EventMap extends Record<string, unknown>> {
	#listeners: { [E in keyof EventMap]?: EventCallback<EventMap[E]>[] } = {};

	addEventListener<E extends keyof EventMap>(
		event: E,
		callback: EventCallback<EventMap[E]>,
	): void {
		if (!this.#listeners[event]) {
			this.#listeners[event] = [];
		}
		this.#listeners[event]?.push(callback);
	}

	removeEventListener<E extends keyof EventMap>(
		event: E,
		callback: EventCallback<EventMap[E]>,
	): void {
		const callbacks = this.#listeners[event];
		if (callbacks) {
			this.#listeners[event] = callbacks.filter((cb) => cb !== callback);
		}
	}

	dispatchEvent<E extends keyof EventMap>(
		event: E,
		payload: EventMap[E],
	): void {
		const callbacks = this.#listeners[event];
		if (callbacks) {
			callbacks.forEach((cb) => cb(payload));
		}
	}
}
