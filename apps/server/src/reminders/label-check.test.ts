import { describe, expect, test } from "bun:test";
import type { CareInstruction } from "@health/contracts/care-profile";
import type {
	LabelRead,
	ReminderOccurrence,
} from "@health/contracts/reminders";
import { checkLabel } from "./label-check";

const NOW = Date.parse("2026-10-24T08:10:00.000Z");

const occurrence = (
	patch: Partial<ReminderOccurrence> = {},
): ReminderOccurrence => ({
	id: "5",
	reminderId: "1",
	familyId: "7",
	kind: "medication",
	subjectId: null,
	title: "Metformin morning",
	scheduledFor: "2026-10-24T08:00:00.000Z",
	state: "delivered",
	promptDue: false,
	prompts: 1,
	nextPromptAt: null,
	...patch,
});

const instruction: CareInstruction = {
	id: "3",
	familyId: "7",
	kind: "medication",
	name: "Metformin",
	instruction: "Take one 500 mg tablet with breakfast",
	times: ["08:00"],
	timeZone: "UTC",
	reason: null,
	source: "pharmacy label",
	effectiveDate: "2026-10-01",
	editedBy: "a".repeat(64),
	editedAt: "2026-10-01T00:00:00.000Z",
	verification: "verified",
	verifiedBy: "a".repeat(64),
	verifiedAt: "2026-10-01T00:00:00.000Z",
};

const label = (patch: Partial<LabelRead> = {}): LabelRead => ({
	patientName: "PARK, HELEN M",
	drugName: "Glucophage (metformin HCl)",
	strength: "500 MG",
	directions: "Take 1 tablet by mouth with breakfast",
	rxNumber: "RX 0412345",
	confidence: 0.92,
	...patch,
});

const dose = (patch: Partial<Parameters<typeof checkLabel>[1]> = {}) => ({
	occurrence: occurrence(),
	preferredName: "Helen Park",
	allergies: ["Penicillin"],
	instructions: [instruction],
	now: NOW,
	...patch,
});

describe("checkLabel", () => {
	test("matches across name order, case, a typo, and a generic name in parentheses", () => {
		expect(checkLabel(label({ patientName: "Hellen Park" }), dose())).toEqual({
			verdict: "match",
			reasons: [],
			read: label({ patientName: "Hellen Park" }),
		});
		expect(checkLabel(label(), dose()).verdict).toBe("match");
	});

	test("another person's label is a mismatch that names both people", () => {
		expect(
			checkLabel(label({ patientName: "Robert Lee" }), dose()),
		).toMatchObject({
			verdict: "mismatch",
			reasons: ["Label says Robert Lee. This dose is for Helen Park."],
		});
	});

	test("a wrong drug, a wrong strength, and an allergy are each reasons", () => {
		expect(
			checkLabel(label({ drugName: "Lisinopril" }), dose()).reasons,
		).toEqual(["Label says Lisinopril. This dose is Metformin."]);
		expect(checkLabel(label({ strength: "1000 mg" }), dose()).reasons).toEqual([
			"Label says 1000 mg. The care plan says “Take one 500 mg tablet with breakfast”.",
		]);
		expect(
			checkLabel(
				label({ drugName: "Penicillin VK" }),
				dose({ occurrence: occurrence({ title: "Penicillin VK" }) }),
			).reasons,
		).toEqual(["Allergy on file: Penicillin."]);
	});

	test("an unsure or incomplete reading asks for a retake, never a match", () => {
		for (const read of [
			label({ confidence: 0.5 }),
			label({ patientName: null }),
			label({ drugName: null }),
		])
			expect(checkLabel(read, dose()).verdict).toBe("retake");
	});

	test("a dose already given or not due now is a mismatch, even on an unreadable label", () => {
		const given = dose({
			occurrence: occurrence({ state: "self_reported_complete" }),
		});
		expect(checkLabel(label(), given)).toMatchObject({
			verdict: "mismatch",
			reasons: ["This dose was already given."],
		});
		expect(checkLabel(label({ confidence: 0.2 }), given).verdict).toBe(
			"mismatch",
		);
		expect(
			checkLabel(label(), dose({ now: NOW + 3 * 60 * 60_000 })).reasons,
		).toEqual(["This dose is not due now: it is due 190 minutes ago."]);
	});
});
