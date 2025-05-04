export const DEFAULT_HOSTNAME = "127.0.0.1";
export const DEFAULT_PORT = 2525;
export const DEFAULT_DOMAIN = "SMTPSAURUS.EMAIL";

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

		const writer = connection.writable.getWriter();
		const textEncoder = new TextEncoder();

		// See RFC821, section 4.3 SEQUENCING OF COMMANDS AND REPLIES:
		// https://www.rfc-editor.org/rfc/rfc821.txt

		// Initial greeting
		await writer.write(
			textEncoder.encode(`${220} ${this.domain} Service ready\r\n`),
		);

		connection.close();
	}

	private async startMainLoop(): Promise<void> {
		while (true) {
			try {
				const connection = await this.listener.accept();

				this.handleConnection(connection);
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
