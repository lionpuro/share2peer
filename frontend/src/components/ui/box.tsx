import { cn } from "#/lib/helper";
import type { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLDivElement>;

export function Box({ children, className, ...props }: Props) {
	return (
		<div
			className={cn(
				"flex flex-col rounded-xl border border-secondary p-4 sm:p-6",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}
