import { Data } from "./store.ts";

export function generateEmail(): Data {
	const senderEmail = "rawr@smtpsaurus.email";
	const recipientEmails = ["deno@smtpsaurus.email", "node@smtpsaurus.email"];
	const messageId = `<${crypto.randomUUID()}@smtpsaurus.email>`;
	const email = `From: smtpsaurus <${senderEmail}>
To: ${recipientEmails.join(", ")}
Subject: Rawr!
Message-ID: ${messageId}
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
		email,
		messageId,
		senderEmail,
		recipientEmails,
	};
}
