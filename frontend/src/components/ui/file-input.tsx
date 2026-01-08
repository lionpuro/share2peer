import {
	type ChangeEvent,
	type InputHTMLAttributes,
	type DragEvent,
	useState,
} from "react";
import { cn } from "#/lib/helper";

type Props = InputHTMLAttributes<HTMLInputElement> & {
	activeClassName?: string;
	onFileInput: (files: File[]) => void;
};

export function FileInput({
	onFileInput,
	children = "Select files",
	className,
	activeClassName = "",
	...props
}: Props) {
	const [dragging, setDragging] = useState(false);

	function onChange(e: ChangeEvent<HTMLInputElement>) {
		const files = e.currentTarget.files;
		if (!files) return;
		onFileInput([...files]);
		e.target.files = null;
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		setDragging(false);
		if (!e.dataTransfer?.items) {
			return;
		}
		const files: File[] = [];
		[...e.dataTransfer.items].forEach((item) => {
			if (item.kind === "file") {
				const file = item.getAsFile();
				if (!file) return;
				files.push(file);
			}
		});
		onFileInput(files);
	}

	function onDragOver(e: DragEvent) {
		e.preventDefault();
	}

	function onDragEnter(e: DragEvent) {
		e.preventDefault();
		if (!dragging) {
			setDragging(true);
		}
	}

	function onDragLeave(e: DragEvent) {
		e.preventDefault();
		if (dragging) {
			setDragging(false);
		}
	}

	return (
		<>
			<label
				htmlFor="file-upload"
				className={cn(
					"cursor-pointer overflow-hidden",
					className,
					dragging ? activeClassName : "",
				)}
				onDrop={onDrop}
				onDragOver={onDragOver}
				onDragEnter={onDragEnter}
				onDragLeave={onDragLeave}
			>
				{children}
			</label>
			<input
				id="file-upload"
				name="file-upload"
				type="file"
				className="hidden"
				onChange={onChange}
				{...props}
			/>
		</>
	);
}
