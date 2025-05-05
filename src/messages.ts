/**
 * Reads a message from a TCP connection, decoding it as a string.
 *
 * @param connection - A Deno TCP connection to read from.
 * @returns A Promise that resolves to the decoded message string or
 * `undefined` if the connection was closed without sending data.
 *
 * @example
 * ```ts
 * const connection = await Deno.connect({
 *     port: 2525,
 *     hostname: '127.0.0.1',
 * });
 *
 * const message = await readMessage(connection);
 *
 * console.log("Received:", message);
 * ```
 */
export async function readMessage(
	connection: Deno.TcpConn,
): Promise<string | undefined> {
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

/**
 * Writes a message to a TCP connection by encoding it as bytes and sending it.
 *
 * @param connection - A Deno TCP connection to write to.
 * @param message - The message to send as a string.
 * @returns A Promise that resolves to `void` when the message is written.
 *
 * @example
 * ```ts
 * const connection = await Deno.connect({
 *     port: 2525,
 *     hostname: '127.0.0.1',
 * });
 *
 * await writeMessage(connection, "Hello, smtpsaurus!");
 * ```
 */
export async function writeMessage(
	connection: Deno.TcpConn,
	message: string,
): Promise<void> {
	const textEncoder = new TextEncoder();
	const writer = connection.writable.getWriter();

	await writer.write(textEncoder.encode(message));
	await writer.releaseLock();
}
