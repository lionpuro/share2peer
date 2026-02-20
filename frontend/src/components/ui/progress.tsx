import { cn } from "#/lib/helper";
import type { ProgressHTMLAttributes } from "react";

type ProgressProps = ProgressHTMLAttributes<HTMLProgressElement>;

export function Progress({ value, max, className, ...props }: ProgressProps) {
	return (
		<progress
			value={value}
			max={max}
			className={cn("progress h-2 flex-1", className)}
			{...props}
		></progress>
	);
}
