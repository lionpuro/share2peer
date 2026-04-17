import { cn } from "#/lib/helper";
import {
	type DialogHTMLAttributes,
	type HTMLAttributes,
	type MouseEvent,
	useLayoutEffect,
	useRef,
} from "react";

type DialogProps = DialogHTMLAttributes<HTMLDialogElement> & { open: boolean };

export function Dialog({ open, className, children, ...props }: DialogProps) {
	const ref = useRef<HTMLDialogElement>(null);
	useLayoutEffect(() => {
		if (ref.current?.open && !open) {
			ref.current.close();
		} else if (!ref.current?.open && open) {
			ref.current?.showModal();
		}
	}, [open]);

	function handleClick(e: MouseEvent<HTMLDialogElement>) {
		const rect = e.currentTarget.getBoundingClientRect();
		if (
			e.clientX < rect.left ||
			e.clientX > rect.right ||
			e.clientY < rect.top ||
			e.clientY > rect.bottom
		) {
			ref.current?.close();
		}
	}

	return (
		<dialog
			{...props}
			onClick={handleClick}
			ref={ref}
			className={cn(
				"fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-transparent backdrop:bg-black/75 dark:backdrop:bg-black/90",
				className,
			)}
		>
			{children}
		</dialog>
	);
}

type DialogContentProps = HTMLAttributes<HTMLDivElement>;

export function DialogContent({ className, children }: DialogContentProps) {
	return (
		<div
			className={cn("flex flex-col rounded-xl bg-background p-6", className)}
		>
			{children}
		</div>
	);
}
