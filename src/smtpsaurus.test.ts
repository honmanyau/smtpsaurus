import { expect } from "jsr:@std/expect";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	it,
} from "jsr:@std/testing/bdd";

import { DEFAULT_HOSTNAME, DEFAULT_PORT, SmtpServer } from "./smtpsaurus.ts";

let server: SmtpServer;

beforeAll(() => {
	server = new SmtpServer();
});

afterAll(async () => {
	await server.cleanUp();
});

describe("SmtpServer", () => {
	let connection: Deno.TcpConn;
	let reader: ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>>;

	beforeEach(async () => {
		connection = await createConnection();
		reader = connection.readable.getReader();
	});

	afterEach(async () => {
		await connection.close();
	});

	it("responds 220 Service ready on successful connection", async () => {
		const { value } = await reader.read();
		const data = new Uint8Array([...(value || [])]);
		const textDecoder = new TextDecoder();
		const message = textDecoder.decode(data);

		expect(message).toMatch(/^220 .+? Service ready\r\n$/);
	});

	it("can be configured with optional parameters", async () => {
		const customDomain = "RAWR.EMAIL";
		const customPort = 65535;

		const customServer = new SmtpServer({
			domain: customDomain,
			port: customPort,
		});

		const customServerConnection = await Deno.connect({
			hostname: DEFAULT_HOSTNAME,
			port: customPort,
		});

		const customConnectionReader = customServerConnection
			.readable
			.getReader();

		const { value } = await customConnectionReader.read();
		const data = new Uint8Array([...(value || [])]);
		const textDecoder = new TextDecoder();
		const text = textDecoder.decode(data);

		expect(text).toMatch(
			new RegExp(`^220 ${customDomain} Service ready\\r\\n$`),
		);

		await customServerConnection.close();
		await customServer.cleanUp();
	});
});

function createConnection(): Promise<Deno.TcpConn> {
	return Deno.connect({
		port: DEFAULT_PORT,
		hostname: DEFAULT_HOSTNAME,
	});
}
