import { assertExists } from "@std/assert";
import { expect } from "@std/expect";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
// @ts-types="npm:@types/nodemailer"
import nodemailer from "nodemailer";

import { DEFAULT_DOMAIN, DEFAULT_HOSTNAME, DEFAULT_PORT } from "./constants.ts";
import { readMessage } from "./messages.ts";
import { SmtpServer } from "./smtpsaurus.ts";

describe("SmtpServer", () => {
	describe("with default server settings", () => {
		let server: SmtpServer;

		beforeEach(() => {
			server = new SmtpServer();

			server.start();
		});

		afterEach(async () => {
			await server.stop();
		});

		it("responds with 220 Simple Mail Transfer Service Ready on successful connection", async () => {
			const connection = await createConnection();
			const clientDomain = "qolloquia.com";

			expect(await readMessage(connection)).toMatch(
				new RegExp([
					`^220 ${DEFAULT_DOMAIN} Simple Mail Transfer Service Ready`,
					"",
				].join("\r\n")),
			);

			await writeMessage(connection, `EHLO ${clientDomain}\r\n`);

			expect(await readMessage(connection)).toMatch(
				new RegExp([
					`250-${DEFAULT_DOMAIN} greets ${clientDomain}`,
					"250-SIZE 26214400",
					"250-8BITMIME",
					"250 HELP",
					"",
				].join("\r\n")),
			);

			await connection.close();
		});

		it("process a well-formed sequence of commands and arguments successfully", async () => {
			const transporter = nodemailer.createTransport({
				host: DEFAULT_HOSTNAME,
				port: DEFAULT_PORT,
				secure: false,
			});

			const recipients = ["deno@smtpsaurus.com", "node@smtpsaurus.com"];
			const subject = crypto.randomUUID();
			const body = crypto.randomUUID();

			const info = await transporter.sendMail({
				from: `"Aya the Narwhal" <aya.the.narwhal@smtpsaurus.email>`,
				to: recipients.join(", "),
				subject,
				text: body,
				html: `<b>${body}</b>`,
			});

			expect(info.response).toBe("250 OK");
			expect(info.accepted).toEqual(expect.arrayContaining(recipients));
			expect(info.rejected).toEqual([]);

			const info2 = await transporter.sendMail({
				from: `"Aya the Narwhal" <aya.the.narwhal@smtpsaurus.email>`,
				to: recipients.join(", "),
				subject,
				text: body,
				html: `<b>${body}</b>`,
			});

			expect(info2.response).toBe("250 OK");
			expect(info2.accepted).toEqual(expect.arrayContaining(recipients));
			expect(info2.rejected).toEqual([]);

			transporter.close();
		});

		it("allows e-mail data to be fetched for a successfully sent message by Message-ID", async () => {
			const transporter = nodemailer.createTransport({
				host: DEFAULT_HOSTNAME,
				port: DEFAULT_PORT,
				secure: false,
			});

			const recipients = ["deno@smtpsaurus.com", "node@smtpsaurus.com"];
			const subject = crypto.randomUUID();
			const body = crypto.randomUUID();

			const info = await transporter.sendMail({
				from: `"Aya the Narwhal" <aya.the.narwhal@smtpsaurus.email>`,
				to: recipients.join(", "),
				subject,
				text: body,
				html: `<b>${body}</b>`,
			});

			const data = await server.mailbox.get(info.messageId);

			assertExists(data);
			expect(data.messageId).toBe(info.messageId);
			expect(data.senderEmail).toBe(info.envelope.from);
			expect(data.recipientEmails).toEqual(
				expect.arrayContaining(info.envelope.to),
			);

			transporter.close();
		});

		it("allows e-mail data to be fetched for a successfully sent message by sender e-mail", async () => {
			const transporter = nodemailer.createTransport({
				host: DEFAULT_HOSTNAME,
				port: DEFAULT_PORT,
				secure: false,
			});

			const senderEmail = `${crypto.randomUUID()}@smtpsaurus.email`;
			const recipients = [
				`${crypto.randomUUID()}@smtpsaurus.email`,
				`${crypto.randomUUID()}@smtpsaurus.email`,
			];
			const subject1 = crypto.randomUUID();
			const subject2 = crypto.randomUUID();
			const body1 = crypto.randomUUID();
			const body2 = crypto.randomUUID();

			const info = await transporter.sendMail({
				from: `"Aya the Narwhal" <${senderEmail}>`,
				to: recipients.join(", "),
				subject: subject1,
				text: body1,
				html: `<b>${body1}</b>`,
			});

			const info2 = await transporter.sendMail({
				from: `"Aya the Narwhal" <${senderEmail}>`,
				to: recipients.join(", "),
				subject: subject2,
				text: body1,
				html: `<b>${body2}</b>`,
			});

			const data = await server.mailbox.getBySender(
				String(info.envelope.from),
			);

			expect(data).toHaveLength(2);
			expect(data).toEqual(expect.arrayContaining([
				expect.objectContaining({
					messageId: info.messageId,
					senderEmail: info.envelope.from,
					recipientEmails: info.envelope.to,
				}),
				expect.objectContaining({
					messageId: info2.messageId,
					senderEmail: info2.envelope.from,
					recipientEmails: info2.envelope.to,
				}),
			]));

			transporter.close();
		});

		it("allows e-mail data to be fetched for a successfully sent message by recipient e-mail", async () => {
			const transporter = nodemailer.createTransport({
				host: DEFAULT_HOSTNAME,
				port: DEFAULT_PORT,
				secure: false,
			});

			const senderEmail = `${crypto.randomUUID()}@smtpsaurus.email`;
			const recipients = [
				`${crypto.randomUUID()}@smtpsaurus.email`,
				`${crypto.randomUUID()}@smtpsaurus.email`,
			];
			const subject1 = crypto.randomUUID();
			const subject2 = crypto.randomUUID();
			const body1 = crypto.randomUUID();
			const body2 = crypto.randomUUID();

			const info = await transporter.sendMail({
				from: `"Aya the Narwhal" <${senderEmail}>`,
				to: recipients.join(", "),
				subject: subject1,
				text: body1,
				html: `<b>${body1}</b>`,
			});

			const info2 = await transporter.sendMail({
				from: `"Aya the Narwhal" <${senderEmail}>`,
				to: recipients.join(", "),
				subject: subject2,
				text: body1,
				html: `<b>${body2}</b>`,
			});

			for (const recipientEmail of info.envelope.to) {
				const data = await server.mailbox.getByRecipient(
					recipientEmail,
				);

				expect(data).toHaveLength(2);
				expect(data).toEqual(expect.arrayContaining([
					expect.objectContaining({
						messageId: info.messageId,
						senderEmail: info.envelope.from,
						recipientEmails: info.envelope.to,
					}),
					expect.objectContaining({
						messageId: info2.messageId,
						senderEmail: info2.envelope.from,
						recipientEmails: info2.envelope.to,
					}),
				]));
			}

			transporter.close();
		});
	});

	describe("with custom server settings", () => {
		const customDomain = "rawr.email";
		const customPort = 65535;

		let server: SmtpServer;

		beforeEach(() => {
			server = new SmtpServer({
				domain: customDomain,
				port: customPort,
			});

			server.start();
		});

		afterEach(async () => {
			await server.stop();
		});

		it("can be configured with optional parameters", async () => {
			const connection = await Deno.connect({
				hostname: DEFAULT_HOSTNAME,
				port: customPort,
			});
			const message = await readMessage(connection);

			expect(message).toMatch(
				new RegExp(
					`^220 ${customDomain} Simple Mail Transfer Service Ready\r\n$`,
				),
			);

			await connection.close();
		});
	});

	describe("attempting to start multiple instances with the same port number", () => {
		it("throws an address in use error", async () => {
			const server1 = new SmtpServer();
			const server2 = new SmtpServer();

			try {
				server1.start();

				expect(() => server2.start()).toThrow(Deno.errors.AddrInUse);
			} finally {
				await server1.stop();
				await server2.stop();
			}
		});

		it("starts a new service at the next available port when `findOpenPort` is set to true", () => {
			const port = 42024;

			const server1 = new SmtpServer({
				port,
				findPortOnConflict: true,
			});

			const server2 = new SmtpServer({
				port,
				findPortOnConflict: true,
			});

			try {
				server1.start();
				server2.start();

				expect(server1.port).toBe(port);
				expect(server2.port).toBe(port + 1);
			} finally {
				server1.stop();
				server2.stop();
			}
		});
	});
});

function createConnection(): Promise<Deno.TcpConn> {
	return Deno.connect({
		port: DEFAULT_PORT,
		hostname: DEFAULT_HOSTNAME,
	});
}

async function writeMessage(
	connection: Deno.TcpConn,
	message: string,
): Promise<void> {
	const textEncoder = new TextEncoder();
	const writer = connection.writable.getWriter();

	await writer.write(textEncoder.encode(message));
	await writer.releaseLock();
}
