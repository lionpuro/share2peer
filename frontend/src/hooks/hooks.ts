import { useCallback, useEffect, useRef, useState } from "react";

type UseResultValue<R, E = Error> =
	| {
			status: "pending";
			result: undefined;
			error: undefined;
	  }
	| {
			status: "success";
			result: R;
			error: undefined;
	  }
	| {
			status: "error";
			result: undefined;
			error: E;
	  };

export function useResult<Result>(
	func: () => Promise<Result>,
	disabled?: boolean,
): UseResultValue<Result> {
	const promise = useRef<Promise<void> | undefined>(undefined);

	const [state, setState] = useState<UseResultValue<Result>>({
		status: "pending",
		result: undefined,
		error: undefined,
	});

	const run = useCallback(() => {
		if (!promise.current) {
			promise.current = (async () => {
				setState({ status: "pending", result: undefined, error: undefined });
				try {
					const result = await func();
					setState({ status: "success", result: result, error: undefined });
				} catch (err) {
					const error =
						err instanceof Error ? err : new Error(JSON.stringify(err));
					setState({ status: "error", result: undefined, error: error });
				} finally {
					promise.current = undefined;
				}
			})();
		}
		return promise.current;
	}, [func]);

	useEffect(() => {
		if (!disabled) {
			run();
		}
	}, [run, disabled]);

	if (disabled) {
		return { status: "pending", result: undefined, error: undefined };
	}
	return state;
}
