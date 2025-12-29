import type { IconBaseProps } from "react-icons";
import {
	IconFileAudio,
	IconFileDefault,
	IconFileImage,
	IconFileVideo,
} from "./icons";

type Props = { mime: string } & IconBaseProps;

export function FileIcon({ mime, ...props }: Props) {
	const parts = mime.split("/");
	switch (parts[0]) {
		case "image":
			return <IconFileImage {...props} />;
		case "video":
			return <IconFileVideo {...props} />;
		case "audio":
			return <IconFileAudio {...props} />;
		default:
			return <IconFileDefault {...props} />;
	}
}
