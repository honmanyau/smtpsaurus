import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { store } from "./store.ts";
import { generateEmail } from "./test-helpers.ts";

describe("The message store", () => {
	it("get(), set(), and invalidate() work", async () => {
		const data = generateEmail();

		await store.set(data);

		expect(await store.get(data.messageId)).toEqual(data);

		await store.invalidate(data.messageId);

		expect(await store.get(data.messageId)).toBeNull();
	});

	it("getBySender() works", async () => {
		const data = generateEmail();
		const data2 = generateEmail();

		await store.set(data);
		await store.set(data2);

		const emails = await store.getBySender(data.senderEmail);

		expect(emails).toHaveLength(2);
		expect(emails).toEqual(expect.arrayContaining([data, data2]));

		await store.invalidate(data.messageId);

		expect(await store.getBySender(data.senderEmail)).toEqual([data2]);

		await store.invalidate(data2.messageId);

		expect(await store.getBySender(data.senderEmail)).toEqual([]);
	});

	it("getByRecipient() works", async () => {
		const data = generateEmail();
		const data2 = generateEmail();

		await store.set(data);
		await store.set(data2);

		const emails = await store.getByRecipient(data.recipientEmails[0]);

		expect(emails).toHaveLength(2);
		expect(emails).toEqual(expect.arrayContaining([data, data2]));

		await store.invalidate(data.messageId);

		expect(await store.getByRecipient(data.recipientEmails[0])).toEqual([
			data2,
		]);

		await store.invalidate(data2.messageId);

		expect(await store.getByRecipient(data.recipientEmails[0])).toEqual(
			[],
		);
	});
});
