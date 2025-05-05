export const SUPPORTED_COMMANDS = [
	"HELO",
	"EHLO",
] as const;

export const SUPPORTED_COMMAND_LOOKUP = SUPPORTED_COMMANDS.reduce(
	(accumulator, value) => {
		accumulator[value] = true;

		return accumulator;
	},
	{} as { [command: string]: true },
);

export const UNSUPPORTED_COMMANDS = [
	"VRFY",
] as const;

export const UNSUPPORTED_COMMAND_LOOKUP = UNSUPPORTED_COMMANDS.reduce(
	(accumulator, value) => {
		accumulator[value] = true;

		return accumulator;
	},
	{} as { [command: string]: true },
);
