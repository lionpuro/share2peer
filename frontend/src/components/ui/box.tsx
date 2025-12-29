import type { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLDivElement>;

export function Box({ children, className, ...props }: Props) {
	return (
		<div
			className={`flex flex-col rounded-xl border border-secondary p-4 ${className ?? ""}`}
			{...props}
		>
			{children}
		</div>
	);
}
