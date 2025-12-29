type Props = { size?: number; className?: string; text?: string };

export function Loader({ size = 36, className, text }: Props) {
	return (
		<div className="fixed top-1/2 left-1/2 flex -translate-x-[50%] -translate-y-[50%] flex-col items-center justify-center gap-2">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width={size}
				height={size}
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				className={`animate-spin text-neutral-400 ${className ? className : ""}`}
			>
				<path d="M21 12a9 9 0 1 1-6.219-8.56" />
			</svg>
			{text && <span className="text-sm text-neutral-800">{text}</span>}
		</div>
	);
}
