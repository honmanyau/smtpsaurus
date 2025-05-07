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

		await store.set(data);

		expect(await store.get(data.messageId)).toEqual(data);
		expect(await store.getBySender(data.senderEmail)).toEqual(data);

		await store.invalidate(data.messageId);

		expect(await store.getBySender(data.senderEmail)).toBeNull();
	});

	it("getByRecipient() works", async () => {
		const data = generateEmail();

		await store.set(data);

		expect(await store.get(data.messageId)).toEqual(data);

		for (const recipientEmail of data.recipientEmails) {
			expect(await store.getByRecipient(recipientEmail)).toEqual(data);
		}

		await store.invalidate(data.messageId);

		for (const recipientEmail of data.recipientEmails) {
			expect(await store.getByRecipient(recipientEmail)).toBeNull();
		}
	});
});
