const kv = await Deno.openKv(":memory:");

const MESSAGE_ID_KEY_PART = "smtpsaurus-message-id";
const MESSAGE_ID_BY_SENDER_KEY_PART = "smtpsaurus-message-id-by-sender";
const MESSAGE_ID_BY_RECIPIENT_KEY_PART = "smtpsaurus-message-id-by-recipient";

export type Data = {
	body: string;
	messageId: string;
	senderEmail: string;
	recipientEmails: string[];
};

async function get(messageId: string): Promise<Data | null> {
	const messageIdKey = makeMessageIdKey(messageId);
	const data = await kv.get<Data>(messageIdKey);

	return data.value;
}

async function getByRecipient(recipientEmail: string): Promise<Data | null> {
	const messageIdByRecipientKey = makeMessageIdByRecipientKey(recipientEmail);
	const messageId = (await kv.get<string>(messageIdByRecipientKey)).value;

	if (!messageId) return null;

	const messageIdKey = makeMessageIdKey(messageId);
	const data = await kv.get<Data>(messageIdKey);

	return data.value;
}

async function getBySender(senderEmail: string): Promise<Data | null> {
	const messageIdBySenderKey = makeMessageIdBySenderKey(senderEmail);
	const messageId = (await kv.get<string>(messageIdBySenderKey)).value;

	if (!messageId) return null;

	const messageIdKey = makeMessageIdKey(messageId);
	const data = await kv.get<Data>(messageIdKey);

	return data.value;
}

async function invalidate(messageId: string): Promise<void> {
	const messageIdKey = makeMessageIdKey(messageId);
	const data = await kv.get<Data>(messageIdKey);

	if (!data.value) return;

	const promises: Promise<void>[] = [];
	const messageIdBySenderKey = makeMessageIdBySenderKey(
		data.value.senderEmail,
	);

	for (const recipientEmail of data.value.recipientEmails) {
		const messageIdByRecipientKey = makeMessageIdByRecipientKey(
			recipientEmail,
		);

		promises.push(
			kv.delete(messageIdKey),
			kv.delete(messageIdBySenderKey),
			kv.delete(messageIdByRecipientKey),
		);
	}

	await Promise.all(promises);
}

async function set(data: Data): Promise<void> {
	const messageIdKey = makeMessageIdKey(data.messageId);
	const messageIdBySenderKey = makeMessageIdBySenderKey(data.senderEmail);

	for (const recipientEmail of data.recipientEmails) {
		const messageIdByRecipientKey = makeMessageIdByRecipientKey(
			recipientEmail,
		);

		await kv.set(messageIdKey, data);
		await kv.set(messageIdBySenderKey, data.messageId);
		await kv.set(messageIdByRecipientKey, data.messageId);
	}
}

function makeMessageIdKey(messageId: string) {
	return [MESSAGE_ID_KEY_PART, messageId];
}

function makeMessageIdByRecipientKey(recipientEmail: string) {
	return [MESSAGE_ID_BY_RECIPIENT_KEY_PART, recipientEmail];
}

function makeMessageIdBySenderKey(senderEmail: string) {
	return [MESSAGE_ID_BY_SENDER_KEY_PART, senderEmail];
}

export const store = {
	get,
	getByRecipient,
	getBySender,
	invalidate,
	set,
};
