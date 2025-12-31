import type { ReactNode } from "react";

export function ErrorComponent({
	error,
	children,
}: {
	error: string;
	children?: ReactNode;
}) {
	return (
		<div className="mx-auto my-8 flex max-w-sm flex-col items-center gap-4">
			<p className="text-center">{error}</p>
			{children}
		</div>
	);
}
