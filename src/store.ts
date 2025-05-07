const kv = await Deno.openKv(":memory:");

const MESSAGE_ID_KEY_PART = "smtpsaurus-message-id";
const MESSAGE_ID_BY_SENDER_KEY_PART = "smtpsaurus-message-id-by-sender";
const MESSAGE_ID_BY_RECIPIENT_KEY_PART = "smtpsaurus-message-id-by-recipient";

export type EmailData = {
	email: string;
	messageId: string;
	senderEmail: string;
	recipientEmails: string[];
};

async function get(messageId: string): Promise<EmailData | null> {
	const messageIdKey = makeMessageIdKey(messageId);
	const data = await kv.get<EmailData>(messageIdKey);

	return data.value;
}

async function getByRecipient(
	recipientEmail: string,
): Promise<(EmailData | null)[]> {
	const messageIdByRecipientKey = makeGetMessageIdsByRecipientKey(
		recipientEmail,
	);

	const messageIds = (await Array.fromAsync(kv.list<string>({
		prefix: messageIdByRecipientKey,
	}))).map(({ value }) => value);

	if (messageIds.length === 0) return [];

	const data = (await Array.fromAsync(
		await kv.getMany<(EmailData | null)[]>(
			messageIds.map(makeMessageIdKey),
		),
	)).map(({ value }) => value);

	return data;
}

async function getBySender(senderEmail: string): Promise<(EmailData | null)[]> {
	const messageIdBySenderKey = makeGetMessageIdsBySenderKey(
		senderEmail,
	);

	const messageIds = (await Array.fromAsync(kv.list<string>({
		prefix: messageIdBySenderKey,
	}))).map(({ value }) => value);

	if (messageIds.length === 0) return [];

	const data = (await Array.fromAsync(
		await kv.getMany<(EmailData | null)[]>(
			messageIds.map(makeMessageIdKey),
		),
	)).map(({ value }) => value);

	return data;
}

async function invalidate(messageId: string): Promise<void> {
	const messageIdKey = makeMessageIdKey(messageId);
	const data = await kv.get<EmailData>(messageIdKey);

	if (!data.value) return;

	const promises: Promise<void>[] = [];
	const messageIdBySenderKey = makeSetMessageIdBySenderKey(
		data.value.senderEmail,
		messageId,
	);

	for (const recipientEmail of data.value.recipientEmails) {
		const messageIdByRecipientKey = makeSetMessageIdByRecipientKey(
			recipientEmail,
			messageId,
		);

		promises.push(
			kv.delete(messageIdKey),
			kv.delete(messageIdBySenderKey),
			kv.delete(messageIdByRecipientKey),
		);
	}

	await Promise.all(promises);
}

async function set(data: EmailData): Promise<void> {
	const messageIdKey = makeMessageIdKey(data.messageId);
	const messageIdBySenderKey = makeSetMessageIdBySenderKey(
		data.senderEmail,
		data.messageId,
	);

	for (const recipientEmail of data.recipientEmails) {
		const messageIdByRecipientKey = makeSetMessageIdByRecipientKey(
			recipientEmail,
			data.messageId,
		);

		await kv.set(messageIdKey, data);
		await kv.set(messageIdBySenderKey, data.messageId);
		await kv.set(messageIdByRecipientKey, data.messageId);
	}
}

function makeMessageIdKey(messageId: string) {
	return [MESSAGE_ID_KEY_PART, messageId];
}

function makeGetMessageIdsByRecipientKey(recipientEmail: string) {
	return [MESSAGE_ID_BY_RECIPIENT_KEY_PART, recipientEmail];
}

function makeGetMessageIdsBySenderKey(senderEmail: string) {
	return [MESSAGE_ID_BY_SENDER_KEY_PART, senderEmail];
}

function makeSetMessageIdByRecipientKey(
	recipientEmail: string,
	messageId: string,
) {
	return [MESSAGE_ID_BY_RECIPIENT_KEY_PART, recipientEmail, messageId];
}

function makeSetMessageIdBySenderKey(senderEmail: string, messageId: string) {
	return [MESSAGE_ID_BY_SENDER_KEY_PART, senderEmail, messageId];
}

export const store = {
	get,
	getByRecipient,
	getBySender,
	invalidate,
	set,
};
