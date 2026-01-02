import {
	type ChangeEvent,
	type InputHTMLAttributes,
	type DragEvent,
	useState,
} from "react";
import { IconUpload } from "#/components/icons";
import { cn } from "#/lib/helper";

type Props = InputHTMLAttributes<HTMLInputElement> & {
	labelText?: string;
	onFileInput: (files: File[]) => void;
};

export function FileInput({
	onFileInput,
	labelText = "Drag and drop files here, or click to browse files",
	className,
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
					"flex cursor-pointer flex-col items-center justify-center overflow-hidden border-2 border-dashed p-10",
					dragging
						? "border-primary/80 bg-primary/10"
						: "border-neutral-400/60 hover:border-primary/60 hover:bg-primary/5",
					className,
				)}
				onDrop={onDrop}
				onDragOver={onDragOver}
				onDragEnter={onDragEnter}
				onDragLeave={onDragLeave}
			>
				<IconUpload
					width={36}
					height={36}
					className={`pointer-events-none ${dragging ? "text-primary" : "text-neutral-400"}`}
				/>
				<span className="pointer-events-none mt-2 text-center text-sm font-medium text-muted-foreground">
					{labelText}
				</span>
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
