# `smtpsaurus` 💌 🦕

## Introduction

`smtpsaurus` is a local SMTP server built for Deno **test** environments. It
implements basic functionality for receiving and storing e-mails, and provides
an API for fetching stored e-mails.

⚠️ Warning: This library is meant to be used in tests only and should absolutely
not be used in production systems. It currently lacks features such as TLS,
authentication, and has minimal validation and error handling.

## Installation

`smtpsaurus` is written with Deno 2 in mind. While version 1 is not officially
supported, tests are passing in version 1.45.0.

To add `smtpsaurus` to your Deno project:

```sh
deno add jsr:@smtpsaurus/smtpsaurus
```

`smtpsaurus` uses Deno KV as for storing e-mails in memory for retrieval, you
will need to add the `--unstable-kv` CLI flag when running code that uses
`smtpsaurus`.

## Usage

Starting an SMTP server with default settings (port: 2525, domain:
smtpsaurus.email) and retrieving sent e-mails:

```ts
import { SmtpServer } from "jsr:@smtpsaurus/smtpsaurus";

// Creating a new instance and starting the server.
const server = new SmtpServer();

// Retrieving e-mails.
const messageId = "<b3e84b8d-0128-422e-ba89-af074e87d28e@smtpsaurus.email>";
const senderEmail = "rawr@smtpsaurus.email";
const recipientEmails = ["deno@smtpsaurus.email", "node@smtpsaurus.email"];

server.mailbox.get(messageId);
server.mailbox.getBySender(senderEmail);
server.mailbox.getByRecipient(recipientEmails[0]);

// Stopping the server.
await server.stop();
```

Starting a server with custom settings:

```ts
const server = new SmtpServer({
	domain: "happy-smtpsaurus.email",
	port: 65535,
});
```

## API documentation

Please see the automatically generated API documentation on JSR:
https://jsr.io/@smtpsaurus/smtpsaurus/doc.

## Examples

### Using `smtpsaurus` in tests

```ts
import { SmtpServer } from "jsr:@smtpsaurus/smtpsaurus";
import { expect } from "jsr:@std/expect";
import { afterEach, beforeEach, describe, it } from "jsr:@std/testing/bdd";
// @ts-types="npm:@types/nodemailer"
import nodemailer from "nodemailer";

describe("SmtpServer", () => {
	let server: SmtpServer;

	beforeEach(() => {
		// Setting `findPortOnConflict` to `true` may be useful when running
		// tests in parallel, as it allows `smtpsaurus` to find an open
		// automatically if the one specified is in use.
		server = new SmtpServer({
			port: 42024,
			findPortOnConflict: true
			quiet: true
		});
	});

	afterEach(async () => {
		await server.stop();
	});

	it("process a well-formed sequence of commands", async () => {
		const transporter = nodemailer.createTransport({
			host: server.hostname,
			port: server.port,
			secure: false,
		});

		// Send an e-mail with nodemailer.
		const info = await transporter.sendMail({
			from: `"smtpsaurus" <test@smtpsaurus.email>`,
			to: "user@smtpsaurus.com",
			subject: "Test Email",
			text: "Hello, world!",
		});

		expect(info.response).toBe("250 OK");

		// Retrieve the sent e-mail from smtpsaurus.
		const data = await server.mailbox.get(info.messageId);

		assertExists(data);

		expect(data.messageId).toBe(info.messageId);
		expect(data.senderEmail).toBe(info.envelope.from);
		expect(data.recipientEmails).toEqual(
			expect.arrayContaining(info.envelope.to),
		);

		transporter.close();
	});
});
```
