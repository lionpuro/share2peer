import {
	IconFileAudio,
	IconFileDefault,
	IconFileImage,
	IconFileVideo,
} from "./icons";

export function FileIcon({ mime }: { mime: string }) {
	const parts = mime.split("/");
	switch (parts[0]) {
		case "image":
			return <IconFileImage />;
		case "video":
			return <IconFileVideo />;
		case "audio":
			return <IconFileAudio />;
		default:
			return <IconFileDefault />;
	}
}
