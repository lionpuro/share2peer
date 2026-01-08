import type { ReactNode } from "react";

export function Main({ children }: { children?: ReactNode }) {
	return (
		<main className="mx-auto flex w-full max-w-screen-sm grow flex-col p-6 sm:p-8">
			{children}
		</main>
	);
}
