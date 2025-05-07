import { readMessage, writeMessage } from "./messages.ts";
import { parseHeaderSection } from "./parsers.ts";
import {
	SUPPORTED_COMMAND_LOOKUP,
	UNSUPPORTED_COMMAND_LOOKUP,
} from "./smtp-commands.ts";
import { store } from "./store.ts";

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
	hostname: string;
	port: number;

	mailbox = {
		get: store.get,
		getBySender: store.getBySender,
		getByRecipient: store.getByRecipient,
	} as const;

	private listener: Deno.TcpListener | undefined;
	private mainLoopExitSignal: Promise<void>;

	constructor(config?: ServerConfig) {
		this.domain = config?.domain ?? DEFAULT_DOMAIN;
		this.port = config?.port ?? DEFAULT_PORT;
		this.hostname = DEFAULT_HOSTNAME;

		this.listener = Deno.listen({
			hostname: this.hostname,
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
		const [, helloCommand, helloMessage] =
			helloLine?.match(new RegExp(`^([A-Z]+?) (.+)${CRLF}$`)) ?? [];

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

		// Handle MAIL
		const mailLine = await readMessage(connection);
		const [, mailCommand, senderEmail] = mailLine?.match(
			new RegExp(`^(MAIL) FROM:<(.+?@.+?\..+)${CRLF}$`),
		) ?? [];

		// TODO|Honman Yau|2025-05-05
		// Handle error cases for the MAIL command.

		await writeMessage(connection, `${250} OK${CRLF}`);

		// Handle RCPT
		const recipientEmails: string[] = [];

		let nextLine = await readMessage(connection);

		while (nextLine?.startsWith("RCPT")) {
			const [, recipientCommand, recipientEmail] = nextLine?.match(
				new RegExp(`^(RCPT) TO:<(.+?@.+?\..+)${CRLF}$`),
			) ?? [];

			// TODO|Honman Yau|2025-05-05
			// Handle error cases for the RCPT command.

			recipientEmails.push(recipientEmail);
			await writeMessage(connection, `${250} OK${CRLF}`);

			nextLine = await readMessage(connection);
		}

		// Handle DATA
		const dataLine = nextLine;

		// TODO|Honman Yau|2025-05-05
		// Handle error cases for the DATA command.
		if (dataLine !== `DATA${CRLF}`) {}

		await writeMessage(
			connection,
			`${354} Start mail input; end with <CRLF>.<CRLF>${CRLF}`,
		);

		const emailLines: string[] = [];

		nextLine = await readMessage(connection);

		while (nextLine) {
			emailLines.push(nextLine);

			if (emailLines.join("").endsWith(`${CRLF}.${CRLF}`)) break;

			nextLine = await readMessage(connection);
		}

		const email = emailLines.join("\r\n");
		const headerSection = parseHeaderSection(email);

		await store.set({
			email: email,
			messageId: headerSection.messageId,
			senderEmail: headerSection.from,
			recipientEmails: headerSection.to,
		});

		await writeMessage(connection, `${250} OK${CRLF}`);

		// Handle QUIT
		const quitLine = await readMessage(connection);

		// TODO|Honman Yau|2025-05-05
		// Handle error cases for the QUIT command.
		if (quitLine !== `QUIT${CRLF}`) {}

		await writeMessage(
			connection,
			`${this.domain} Service closing transmission channel${CRLF}`,
		);
	}

	private async startMainLoop(): Promise<void> {
		while (this.listener) {
			try {
				const connection = await this.listener.accept();

				await this.handleConnection(connection);

				connection.close();
			} catch (error) {
				if (error instanceof Deno.errors.BadResource) {
					continue;
				}

				throw error;
			}
		}
	}

	async stop(): Promise<void> {
		this.listener?.close();
		this.listener = undefined;
		await this.mainLoopExitSignal;
	}
}
