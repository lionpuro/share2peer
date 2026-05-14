import { useEffect, useRef, useState } from "react";

export function useWakeLock() {
	const lock = useRef<WakeLockSentinel>(null);
	const [active, setActive] = useState(false);

	useEffect(() => {
		let mounted = true;

		const request = async () => {
			await lock.current?.release();
			await navigator.wakeLock
				.request("screen")
				.then((wl) => {
					if (!mounted) {
						wl.release().catch(() => {});
						return;
					}
					wl.addEventListener("release", () => {
						setActive(false);
						lock.current = null;
					});
					lock.current = wl;
					setActive(true);
				})
				.catch((err) => {
					if (!mounted) {
						return;
					}
					console.error(
						"request wake lock:",
						err instanceof Error ? err.message : JSON.stringify(err),
					);
					throw err;
				});
		};

		const handleClick = () => {
			document.removeEventListener("click", handleClick);
			request().catch(() => {});
		};

		const handleVisibility = async () => {
			if (document.visibilityState === "visible") {
				await request().catch(() => {
					document.addEventListener("click", handleClick);
				});
				return;
			}

			document.removeEventListener("click", handleClick);
			document.removeEventListener("click", handleClick);
		};

		request().catch(() => {
			document.addEventListener("click", handleClick);
		});

		document.addEventListener("visibilitychange", handleVisibility);

		return () => {
			mounted = false;
			lock.current?.release().catch(() => {});
			lock.current = null;
			document.removeEventListener("visibilitychange", handleVisibility);
		};
	}, []);

	return { active };
}
