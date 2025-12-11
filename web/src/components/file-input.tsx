import {
	type ChangeEvent,
	type InputHTMLAttributes,
	type DragEvent,
	useState,
} from "react";
import { IconUpload } from "../icons";

type Props = InputHTMLAttributes<HTMLInputElement> & {
	labelText?: string;
	onFileInput: (files: File[]) => void;
};

export function FileInput({
	onFileInput,
	labelText = "Choose file",
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
				className={`flex flex-col items-center justify-center border-2 border-dashed p-12 hover:border-blue-400 ${dragging ? "border-blue-400" : "border-neutral-400/80"} cursor-pointer ${className || ""} overflow-hidden`}
				onDrop={onDrop}
				onDragOver={onDragOver}
				onDragEnter={onDragEnter}
				onDragLeave={onDragLeave}
			>
				<IconUpload
					size={48}
					className={`pointer-events-none ${dragging ? "fill-blue-400" : "fill-neutral-400"}`}
				/>
				<span className="pointer-events-none mt-2 text-center font-medium">
					{labelText}
				</span>
			</label>
			<input
				id="file-upload"
				name="file-upload"
				type="file"
				className="hidden"
				{...props}
				onChange={onChange}
			/>
		</>
	);
}
