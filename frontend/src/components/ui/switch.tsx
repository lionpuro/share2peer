import type { InputHTMLAttributes } from "react";
import { cn } from "#/lib/helper";

type SwitchProps = InputHTMLAttributes<HTMLInputElement> & { id: string };

export function Switch({ id, className, checked, ...props }: SwitchProps) {
	return (
		<label className={cn("cursor-pointer", className)} htmlFor={id}>
			<input
				id={id}
				type="checkbox"
				className="hidden"
				checked={checked}
				{...props}
			/>
			<div
				className={cn(
					"flex w-9 rounded-full p-0.5",
					checked ? "bg-primary" : "bg-secondary-darker dark:bg-secondary",
				)}
			>
				<span
					className={cn(
						"size-4 rounded-full bg-white",
						"transition-all duration-100",
						checked && "translate-x-4",
					)}
				></span>
			</div>
		</label>
	);
}
