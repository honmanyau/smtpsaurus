import { assertExists } from "$std/assert/assert_exists.ts";

type HeaderSection = {
	from: string;
	to: string[];
	subject: string;
	messageId: string;
	date: string;
};

export function parseHeaderSection(data: string): HeaderSection {
	const lines = data.split("\n");
	const headerSection: HeaderSection = {
		from: "",
		to: [],
		subject: "",
		messageId: "",
		date: "",
	};

	let headerField = "";

	for (const line of lines) {
		if (headerField === "" || line.match(/^\s\S/)) {
			headerField = headerField.trim() + line;
			continue;
		}

		const matched = headerField.trim().match(/^(.+?): (.+)$/);

		if (!matched) {
			throw new Error(`Malformed header`, {
				cause: {
					code: "MalformedHeaderField",
					value: headerField,
				},
			});
		}

		const [, headerFieldName, headerFieldContent] = matched;

		switch (headerFieldName.toLowerCase()) {
			case "from": {
				const senderEmail = headerFieldContent.match(
					/^.+?<(.+?@.+?\..+)>$/,
				)?.[1];

				assertExists(senderEmail);

				headerSection.from = senderEmail;

				break;
			}

			case "to": {
				headerSection.to = headerFieldContent.split(",").map((email) =>
					email.trim()
				);

				break;
			}

			case "subject": {
				headerSection.subject = headerFieldContent;

				break;
			}

			case "message-id": {
				const messageId = headerFieldContent.match(
					/^(<.+>)$/,
				)?.[1];

				assertExists(messageId);

				headerSection.messageId = messageId;

				break;
			}

			case "date": {
				headerSection.date = headerFieldContent;

				break;
			}

			default: {
				break;
			}
		}

		headerField = line;

		if (line.trim() === "") break;
	}

	// TODO|Honman Yau|2025-05-06
	// Validate `headerSection` before returning.

	return headerSection;
}
