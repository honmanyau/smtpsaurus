import {
	CRLF,
	DEFAULT_DOMAIN,
	DEFAULT_HOSTNAME,
	DEFAULT_PORT,
} from "./constants.ts";
import { readMessage, writeMessage } from "./messages.ts";
import { parseHeaderSection } from "./parsers.ts";
import {
	SUPPORTED_COMMAND_LOOKUP,
	UNSUPPORTED_COMMAND_LOOKUP,
} from "./smtp-commands.ts";
import { store } from "./store.ts";

/**
 * Configuration options for an `smtpsaurus` instance.
 */
export type ServerConfig = {
	/**
	 * Optional domain name for the server.
	 * @default DEFAULT_DOMAIN
	 */
	domain?: string;

	/**
	 * Optional port number for the server.
	 * @default DEFAULT_PORT
	 */
	port?: number;
};

/**
 * A basic SMTP server that performs the essential parts of an SMTP transaction,
 * according to the sequence specified in RFC 821 (https://www.rfc-editor.org/rfc/rfc821.txt),
 * for "sending" and e-mail and provides an interface for retrieving those
 * e-mails.
 *
 * @example Using `smtpsaurus` for receiving and retrieving e-mails in tests.
 * ```ts
 * import { SmtpServer } from "jsr:@smtpsaurus/smtpsaurus";
 * import { expect } from "jsr:@std/expect";
 * import { afterEach, beforeEach, describe, it } from "jsr:@std/testing/bdd";
 * // @ts-types="npm:@types/nodemailer"
 * import nodemailer from "nodemailer";
 *
 * describe("SmtpServer", () => {
 *   let server: SmtpServer;
 *
 *   beforeEach(() => {
 *     server = new SmtpServer();
 *	 });
 *
 *   afterEach(async () => {
 *     await server.stop();
 *   });
 *
 *   it("process a well-formed sequence of commands", async () => {
 *     const transporter = nodemailer.createTransport({
 *       host: server.hostname,
 *       port: server.port,
 *       secure: false,
 *     });
 *
 *     // Send an e-mail with nodemailer.
 *     const info = await transporter.sendMail({
 *       from:`"smtpsaurus" <test@smtpsaurus.email>`,
 *       to: "user@smtpsaurus.com",
 *       subject: "Test Email",
 *       text: "Hello, world!",
 *     });
 *
 *     expect(info.response).toBe("250 OK");
 *
 *     // Retrieve the sent e-mail from smtpsaurus.
 *     const data = await server.mailbox.get(info.messageId);
 *
 *     assertExists(data);
 *
 *     expect(data.messageId).toBe(info.messageId);
 *     expect(data.senderEmail).toBe(info.envelope.from);
 *     expect(data.recipientEmails).toEqual(
 *       expect.arrayContaining(info.envelope.to),
 *     );
 *
 *     transporter.close();
 *   });
 * });
```
 *
 */
export class SmtpServer {
	/**
	 * Domain name associated with the server; for example, smtpsaurus.email.
	 * This is the name that the server uses to identify itself, such as in
	 * the initial greeting, to the sender during an SMTP transaction
	 */
	domain: string;

	/**
	 * Hostname where the server is running; for example 127.0.0.1.
	 */
	hostname: string;

	/**
	 * Port number the server is listening on.
	 */
	port: number;

	/**
	 * Provides access to mailbox operations, such as retrieving emails.
	 *
	 * @property {function(string): Promise<EmailData | null>} get Retrieve an e-mail
	 * by its Message-ID.
	 * @property {function(string): Promise<(EmailData | null)[]>} getBySender Retrieve
	 * all e-mails sent from the a given e-mail address.
	 * specific sender.
	 * @property {function(string): Promise<(EmailData | null)[]>} getByRecipient
	 * Retrieve all e-mails sent to a specific recipient.
	 */
	mailbox = {
		get: store.get,
		getBySender: store.getBySender,
		getByRecipient: store.getByRecipient,
	} as const;

	/**
	 * @private
	 * TCP listener for incoming connections.
	 */
	private listener: Deno.TcpListener | undefined;

	/**
	 * @private
	 * Promise that resolves when the main server loop exits. The main sever
	 * loop exits either `this.listener` becomes `undefined`, which happens when
	 * a connection closes or when we call `close()`, or when an unhandled
	 * exception occurs.
	 */
	private mainLoopExitSignal: Promise<void>;

	/**
	 * Constructor for the SmtpServer class. Initializes server configuration
	 * and starts listening for incoming connections.
	 *
	 * @param config Optional configuration object specifying domain and port.
	 */
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

	/**
	 * @private
	 * Handles an individual SMTP connection. This method implements the
	 * sequence of commands specified in RFC 821 (https://www.rfc-editor.org/rfc/rfc821.txt)
	 * for handling an SMTP transaction.
	 *
	 * @param connection The TCP connection to handle
	 * @returns Promise that resolves when an SMTP transaction has finished.
	 */
	private async handleConnection(connection: Deno.TcpConn): Promise<void> {
		const clientHostname = connection.remoteAddr.hostname;
		const clientPort = connection.remoteAddr.port;

		console.log(`🛜 New connection from ${clientHostname}:${clientPort}.`);

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
		const [, _mailCommand, _senderEmail] = mailLine?.match(
			new RegExp(`^(MAIL) FROM:<(.+?@.+?\..+)${CRLF}$`),
		) ?? [];

		// TODO|Honman Yau|2025-05-05
		// Handle error cases for the MAIL command.

		await writeMessage(connection, `${250} OK${CRLF}`);

		// Handle RCPT
		const recipientEmails: string[] = [];

		let nextLine = await readMessage(connection);

		while (nextLine?.startsWith("RCPT")) {
			const [, _recipientCommand, recipientEmail] = nextLine?.match(
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

		if (dataLine !== `DATA${CRLF}`) {
			// TODO|Honman Yau|2025-05-05
			// Handle error cases for the DATA command.
		}

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

		if (quitLine !== `QUIT${CRLF}`) {
			// TODO|Honman Yau|2025-05-05
			// Handle error cases for the QUIT command.
		}

		await writeMessage(
			connection,
			`${this.domain} Service closing transmission channel${CRLF}`,
		);
	}

	/**
	 * @private
	 * Main loop for handling incoming connections.
	 * This method runs continuously, accepting new connections and processing them.
	 *
	 * @returns Promise that resolves when the server stops
	 */
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

	/**
	 * Stop the server.
	 *
	 * @returns Promise that resolves when the listener has closed and the
	 * main loop has exited.
	 */
	async stop(): Promise<void> {
		this.listener?.close();
		this.listener = undefined;
		await this.mainLoopExitSignal;
	}
}
