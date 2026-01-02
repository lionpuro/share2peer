import type { DeviceType } from "#/lib/client";
import { IconDesktop, IconMobile, IconTablet, type IconProps } from "./icons";

export function DeviceIcon({
	deviceType,
	...props
}: { deviceType: DeviceType } & IconProps) {
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
