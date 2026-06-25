import { useState } from "react";

interface Props {
	url: string;
	name: string;
}

function initials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) {
		return "?";
	}
	if (parts.length === 1) {
		return parts[0].slice(0, 2).toUpperCase();
	}
	return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorFromName(name: string): string {
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = name.charCodeAt(i) + ((hash << 5) - hash);
	}
	const hue = Math.abs(hash) % 360;
	return `hsl(${hue}, 45%, 45%)`;
}

export function Avatar({ url, name }: Props) {
	const [failed, setFailed] = useState(false);

	if (failed || !url) {
		return (
			<span
				className="avatar avatar-fallback"
				style={{ backgroundColor: colorFromName(name) }}
				title={name}
			>
				{initials(name)}
			</span>
		);
	}

	return (
		<img
			className="avatar"
			src={url}
			alt={name}
			title={name}
			onError={() => setFailed(true)}
		/>
	);
}
