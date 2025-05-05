import { expect } from "jsr:@std/expect";
import { afterEach, beforeEach, describe, it } from "jsr:@std/testing/bdd";

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
			const message = await getNextMessage(connection);

			expect(message).toMatch(
				/^220 .+? Simple Mail Transfer Service Ready\r\n$/,
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

			const message = await getNextMessage(connection);

			expect(message).toMatch(
				new RegExp(
					`^220 ${customDomain} Simple Mail Transfer Service Ready\\r\\n$`,
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

async function getNextMessage(connection: Deno.TcpConn): Promise<string> {
	const reader = connection.readable.getReader();
	const { value } = await reader.read();
	const data = new Uint8Array([...(value || [])]);
	const textDecoder = new TextDecoder();
	const message = textDecoder.decode(data);

	return message;
}
