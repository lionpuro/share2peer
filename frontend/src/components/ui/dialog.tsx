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
				"fixed relative top-1/2 left-1/2 hidden w-full max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-background text-foreground backdrop:bg-black/75 open:flex max-sm:max-w-[calc(100%-(var(--spacing)*8))] dark:bg-muted dark:backdrop:bg-black/90",
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
		<div className={cn("flex grow flex-col overflow-auto p-6", className)}>
			{children}
		</div>
	);
}
