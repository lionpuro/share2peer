import { getSystemTheme, ThemeContext } from "#/context/theme/context";
import { useContext } from "react";
import { Slide, ToastContainer, type ToastOptions } from "react-toastify";

const options: ToastOptions = {
	position: "top-right",
	autoClose: 5000,
	hideProgressBar: true,
	closeOnClick: true,
	pauseOnHover: true,
	pauseOnFocusLoss: false,
	transition: Slide,
};

export function Toast() {
	const { theme } = useContext(ThemeContext);
	return (
		<ToastContainer
			{...options}
			theme={theme === "system" ? getSystemTheme() : theme}
		/>
	);
}
