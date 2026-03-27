import type { HTMLAttributes } from "react";
import { cn } from "#/lib/helper";

const sizes = {
	sm: "font-bold",
	md: "text-lg font-bold",
	lg: "text-3xl md:text-4xl font-bold",
};

type Props = HTMLAttributes<HTMLHeadingElement> & {
	order: 1 | 2 | 3;
	size?: keyof typeof sizes;
};

export function Heading({ order, size, className, children, ...props }: Props) {
	const classes = "leading-none";
	switch (order) {
		case 1:
			return (
				<h1
					className={cn(size ? sizes[size] : sizes.lg, classes, className)}
					{...props}
				>
					{children}
				</h1>
			);
		case 2:
			return (
				<h2
					className={cn(size ? sizes[size] : sizes.md, classes, className)}
					{...props}
				>
					{children}
				</h2>
			);
		case 3:
			return (
				<h3
					className={cn(size ? sizes[size] : sizes.sm, classes, className)}
					{...props}
				>
					{children}
				</h3>
			);
	}
}
