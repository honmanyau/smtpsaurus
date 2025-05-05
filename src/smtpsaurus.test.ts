import { expect } from "jsr:@std/expect";
import { afterEach, beforeEach, describe, it } from "jsr:@std/testing/bdd";

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
			const writer = connection.writable.getWriter();
			const clientDomain = "qolloquia.com";

			expect(await readLine(connection)).toMatch(
				new RegExp([
					`^220 ${DEFAULT_DOMAIN} Simple Mail Transfer Service Ready`,
					"",
				].join("\r\n")),
			);

			await writeMessage(writer, `EHLO ${clientDomain}\r\n`);

			expect(await readLine(connection)).toMatch(
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
			const message = await readLine(connection);

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

async function readLine(connection: Deno.TcpConn): Promise<string | undefined> {
	const reader = connection.readable.getReader();

	try {
		let data = new Uint8Array();

		while (true) {
			const { value, done } = await reader.read();

			if (done) return;

			data = new Uint8Array([...data, ...value]);

			const secondLastIndex = data.length - 2;
			const lastIndex = data.length - 1;
			const crlfEncountered = data[secondLastIndex] === 13 &&
				data[lastIndex] === 10;

			if (crlfEncountered) {
				const textDecoder = new TextDecoder();
				const message = textDecoder.decode(data);

				return message;
			}
		}
	} finally {
		await reader.releaseLock();
	}
}

async function writeMessage(
	writer: WritableStreamDefaultWriter<Uint8Array<ArrayBufferLike>>,
	message: string,
): Promise<void> {
	const textEncoder = new TextEncoder();

	await writer.write(textEncoder.encode(message));
}
