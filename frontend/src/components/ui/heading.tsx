import { cn } from "#/lib/helper";
import type { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLHeadingElement>;

export function H1({ className, children, ...props }: Props) {
	return (
		<h1 className={cn("text-xl font-bold", className)} {...props}>
			{children}
		</h1>
	);
}

export function H2({ className, children, ...props }: Props) {
	return (
		<h2 className={cn("text-lg font-bold", className)} {...props}>
			{children}
		</h2>
	);
}
