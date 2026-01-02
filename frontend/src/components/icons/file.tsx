import {
	IconFileAudio,
	IconFileDefault,
	IconFileImage,
	IconFileVideo,
	type IconProps,
} from "./icons";

type Props = { mime: string } & IconProps;

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
