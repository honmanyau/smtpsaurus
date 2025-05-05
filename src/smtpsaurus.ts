import { readMessage, writeMessage } from "./messages.ts";
import {
	SUPPORTED_COMMAND_LOOKUP,
	UNSUPPORTED_COMMAND_LOOKUP,
} from "./smtp-commands.ts";

export const CRLF = "\r\n";
export const DEFAULT_HOSTNAME = "127.0.0.1";
export const DEFAULT_PORT = 2525;
export const DEFAULT_DOMAIN = "smtpsaurus.email";

export type ServerConfig = {
	domain?: string;
	port?: number;
};

export class SmtpServer {
	domain: string;
	listener: Deno.TcpListener;
	port: number;

	private mainLoopExitSignal: Promise<void>;

	constructor(config?: ServerConfig) {
		this.domain = config?.domain ?? DEFAULT_DOMAIN;
		this.port = config?.port ?? DEFAULT_PORT;
		this.listener = Deno.listen({
			hostname: DEFAULT_HOSTNAME,
			port: this.port,
		});

		console.log(
			`🦕 smtpsaurus listening at ${this.listener.addr.hostname} on port ${this.port}.`,
		);

		this.mainLoopExitSignal = this.startMainLoop();
	}

	private async handleConnection(connection: Deno.TcpConn): Promise<void> {
		const clientHostname = connection.remoteAddr.hostname;
		const clientPort = connection.remoteAddr.port;

		console.log(`🛜 New connection from ${clientHostname}:${clientPort}.`);

		// See RFC821, section 4.3 SEQUENCING OF COMMANDS AND REPLIES:
		// https://www.rfc-editor.org/rfc/rfc821.txt

		// Initial greeting
		await writeMessage(
			connection,
			`${220} ${this.domain} Simple Mail Transfer Service Ready${CRLF}`,
		);

		// Handle EHLO and HELO
		const helloLine = await readMessage(connection);
		const [_, helloCommand, helloMessage] =
			helloLine?.match(/^([A-Z]+?) (.+)\r\n$/) ?? [];

		if (helloCommand === undefined) {
			await writeMessage(
				connection,
				`${503} ${this.domain} Bad sequence of commands${CRLF}`,
			);

			return;
		} else if (UNSUPPORTED_COMMAND_LOOKUP[helloCommand]) {
			await writeMessage(
				connection,
				`${502} ${this.domain} Command not implemented${CRLF}`,
			);

			return;
		} else if (!SUPPORTED_COMMAND_LOOKUP[helloCommand]) {
			await writeMessage(
				connection,
				`${500} ${this.domain} Syntax error, command unrecognized${CRLF}`,
			);

			return;
		} else if (!helloMessage) {
			// TODO|Honman Yau|2025-05-05
			// Perform rough validation on the client's hostname, too.
			await writeMessage(
				connection,
				`${501} ${this.domain} Syntax error in parameters or arguments${CRLF}`,
			);

			return;
		}

		await writeMessage(
			connection,
			`${250}-${this.domain} greets ${helloMessage}${CRLF}`,
		);

		await await writeMessage(connection, `${250}-SIZE 26214400${CRLF}`);
		await await writeMessage(connection, `${250}-8BITMIME${CRLF}`);
		await await writeMessage(connection, `${250} HELP${CRLF}`);
	}

	private async startMainLoop(): Promise<void> {
		while (true) {
			try {
				const connection = await this.listener.accept();

				await this.handleConnection(connection);

				connection.close();
			} catch (error) {
				if (error instanceof Deno.errors.BadResource) {
					return;
				}

				throw error;
			}
		}
	}

	async cleanUp(): Promise<void> {
		this.listener.close();
		await this.mainLoopExitSignal;
	}
}
