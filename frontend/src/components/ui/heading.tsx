import type { HTMLAttributes } from "react";
import { cn } from "#/lib/helper";

const sizes = {
	sm: "font-bold",
	md: "text-lg font-bold",
	lg: "text-4xl font-extrabold",
};

type Props = HTMLAttributes<HTMLHeadingElement> & {
	order: 1 | 2 | 3;
	size?: keyof typeof sizes;
};

export function Heading({ order, size, className, children, ...props }: Props) {
	switch (order) {
		case 1:
			return (
				<h1 className={cn(size ? sizes[size] : sizes.lg, className)} {...props}>
					{children}
				</h1>
			);
		case 2:
			return (
				<h2 className={cn(size ? sizes[size] : sizes.md, className)} {...props}>
					{children}
				</h2>
			);
		case 3:
			return (
				<h3 className={cn(size ? sizes[size] : sizes.sm, className)} {...props}>
					{children}
				</h3>
			);
	}
}
