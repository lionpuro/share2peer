import type { DeviceType } from "#/lib/client";
import type { IconBaseProps } from "react-icons";
import { IconDesktop, IconMobile, IconTablet } from "./icons";

export function DeviceIcon({
	deviceType,
	...props
}: { deviceType: DeviceType } & IconBaseProps) {
	switch (deviceType) {
		case "desktop":
			return <IconDesktop {...props} />;
		case "tablet":
			return <IconTablet {...props} />;
		case "mobile":
			return <IconMobile {...props} />;
		default:
			return <IconDesktop {...props} />;
	}
}
