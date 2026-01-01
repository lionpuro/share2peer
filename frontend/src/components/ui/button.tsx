import { cn } from "#/lib/helper";
import type { ButtonHTMLAttributes } from "react";

const baseStyles =
	"rounded-lg flex items-center justify-center disabled:bg-muted disabled:text-muted-foreground";

const options = {
	variants: {
		primary: "bg-primary text-white hover:bg-primary-darker",
		secondary: "bg-secondary hover:bg-secondary-darker/80",
	},
	sizes: {
		sm: "px-4 py-2 text-sm font-medium",
		md: "px-4 py-2",
	},
};

type ButtonSize = keyof (typeof options)["sizes"];

type ButtonVariant = keyof (typeof options)["variants"] | "none";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: ButtonVariant;
	size?: ButtonSize;
};

export function Button({
	variant = "primary",
	size = "sm",
	className,
	children,
	...props
}: ButtonProps) {
	const styles = [
		baseStyles,
		variant === "none" ? "" : options.variants[variant],
		variant === "none" ? "" : options.sizes[size],
		className,
	].filter((s) => !!s);
	return (
		<button className={cn(...styles)} {...props}>
			{children}
		</button>
	);
}
