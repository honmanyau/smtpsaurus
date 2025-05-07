import { describe, it } from "$std/testing/bdd.ts";
import { expect } from "@std/expect";
import { parseHeaderSection } from "./parsers.ts";

import { generateEmail } from "./test-helpers.ts";

describe("Parsers", () => {
	describe("parseHeaderSection()", () => {
		it("returns an object containing correct header information", () => {
			const data = generateEmail();
			const headerSection = parseHeaderSection(data.email);

			expect(headerSection.messageId).toBe(data.messageId);
			expect(headerSection.from).toBe(data.senderEmail);
			expect(headerSection.to).toEqual(data.recipientEmails);
			expect(data.email.includes(headerSection.subject)).toBe(true);
		});
	});
});
