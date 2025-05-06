import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { Data, store } from "./store.ts";

describe("The message store", () => {
	it("get(), set(), and invalidate() work", async () => {
		const data = generateData();

		await store.set(data);

		expect(await store.get(data.messageId)).toEqual(data);

		await store.invalidate(data.messageId);

		expect(await store.get(data.messageId)).toBeNull();
	});

	it("getBySender() works", async () => {
		const data = generateData();

		await store.set(data);

		expect(await store.get(data.messageId)).toEqual(data);
		expect(await store.getBySender(data.senderEmail)).toEqual(data);

		await store.invalidate(data.messageId);

		expect(await store.getBySender(data.senderEmail)).toBeNull();
	});

	it("getByRecipient() works", async () => {
		const data = generateData();

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

function generateData(): Data {
	const senderEmail = "rawr@smtpsaurus.email";
	const recipientEmails = ["deno@smtpsaurus.email", "node@smtpsaurus.email"];
	const messageId = `<${crypto.randomUUID()}@smtpsaurus.email`;
	const body = `From: smtpsaurus <${senderEmail}>
To: ${recipientEmails.join(", ")}
Subject: Rawr!
Message-ID: <dc2c3c7e-605c-a3cc-6ffa-4c109d53bd5b@smtpsaurus.email>
Date: Tue, 06 May 2025 11:36:15 +0000
MIME-Version: 1.0
Content-Type: multipart/alternative;
 boundary="--_NmP-0f78f62effa5c5f5-Part_1"

,----_NmP-0f78f62effa5c5f5-Part_1
Content-Type: text/plain; charset=utf-8
Content-Transfer-Encoding: 7bit

Hello, Raaawrld!
----_NmP-0f78f62effa5c5f5-Part_1
Content-Type: text/html; charset=utf-8
Content-Transfer-Encoding: 7bit

<b>Hello, Raaawrld!</b>
----_NmP-0f78f62effa5c5f5-Part_1--
.`;

	return {
		body,
		messageId,
		senderEmail,
		recipientEmails,
	};
}
