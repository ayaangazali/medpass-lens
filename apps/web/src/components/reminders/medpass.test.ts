import { describe, expect, test } from "bun:test";
import type {
	ReminderHistory,
	ReminderKind,
	ReminderState,
} from "@health/contracts/reminders";

import { marGrid, roundDoses } from "./medpass";

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

describe("marGrid", () => {
	const names = (identity: string) => `Name ${identity}`;

	test("rows by time of day, columns by the newest dates, cells by outcome", () => {
		const grid = marGrid(
			[
				dose("3", day(22, 20), "unresolved"),
				dose("2", day(22, 8), "caregiver_confirmed", { actor: "kim" }),
				dose("2-old", day(22, 8), "unresolved"),
				dose("1", day(21, 8), "declined"),
				dose("0", day(20, 8), "self_reported_complete"),
				dose("w", day(22, 9), "caregiver_confirmed", { kind: "meal" }),
			],
			names,
			2,
		);
		expect(grid.dates).toEqual(["2026-10-21", "2026-10-22"]);
		expect(grid.rows.map((r) => r.minute)).toEqual([8 * 60, 20 * 60]);
		expect(grid.rows[0]?.cells).toEqual({
			"2026-10-21": "Declined",
			"2026-10-22": "Name kim",
		});
		expect(grid.rows[1]?.cells).toEqual({ "2026-10-22": "Missed" });
	});
});
