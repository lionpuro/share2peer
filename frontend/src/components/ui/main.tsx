import { cn } from "#/lib/helper";
import type { ReactNode } from "react";

export function Main({
	className,
	children,
}: {
	className?: string;
	children?: ReactNode;
}) {
	return (
		<main
			className={cn(
				"mx-auto flex w-full max-w-screen-sm grow flex-col p-6 sm:p-8",
				className,
			)}
		>
			{children}
		</main>
	);
}
