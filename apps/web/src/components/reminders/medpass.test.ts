import { describe, expect, test } from "bun:test";
import type {
	ReminderHistory,
	ReminderKind,
	ReminderState,
} from "@health/contracts/reminders";

import { roundDoses } from "./medpass";

type Dose = ReminderHistory["occurrences"][number];

const dose = (
	id: string,
	at: Date,
	state: ReminderState,
	{
		title = "Metformin",
		kind = "medication" as ReminderKind,
		actor = "a",
	} = {},
): Dose => ({
	occurrence: {
		id,
		reminderId: "r",
		familyId: "f",
		kind,
		subjectId: null,
		title,
		scheduledFor: at.toISOString(),
		state,
		promptDue: false,
		prompts: 0,
		nextPromptAt: null,
	},
	events: [
		{
			id: `${id}-e`,
			occurrenceId: id,
			state,
			response: null,
			at: at.toISOString(),
			actor,
			source: "web",
			wording: null,
		},
	],
});

const day = (date: number, hour: number, minute = 0) =>
	new Date(2026, 9, date, hour, minute);

describe("roundDoses", () => {
	const now = day(20, 12).getTime();

	test("keeps the due window and today's open doses, missed first", () => {
		const ids = roundDoses(
			[
				dose("later", day(20, 14), "scheduled"),
				dose("soon", day(20, 12, 30), "scheduled"),
				dose("recent", day(20, 11), "caregiver_confirmed"),
				dose("open", day(20, 7), "delivered"),
				dose("given", day(20, 7), "caregiver_confirmed"),
				dose("missed", day(20, 8), "unresolved"),
				dose("yesterday", day(19, 20), "unresolved"),
				dose("walk", day(20, 12), "scheduled", { kind: "meal" }),
			],
			now,
		).map((d) => d.occurrence.id);
		expect(ids).toEqual(["missed", "open", "recent", "soon"]);
	});
});
