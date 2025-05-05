import { expect } from "jsr:@std/expect";
import { afterEach, beforeEach, describe, it } from "jsr:@std/testing/bdd";

import { readMessage } from "./messages.ts";
import { DEFAULT_DOMAIN } from "./mod.ts";
import { DEFAULT_HOSTNAME, DEFAULT_PORT, SmtpServer } from "./smtpsaurus.ts";

describe("SmtpServer", () => {
	describe("with default server settings", () => {
		let server: SmtpServer;

		beforeEach(() => {
			server = new SmtpServer();
		});

		afterEach(async () => {
			await server.cleanUp();
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
		});

		afterEach(async () => {
			await server.cleanUp();
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
