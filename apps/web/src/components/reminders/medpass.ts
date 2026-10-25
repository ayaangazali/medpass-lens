import type {
	ReminderHistory,
	ReminderState,
} from "@health/contracts/reminders";

type Doses = ReminderHistory["occurrences"];

const HOUR = 60 * 60_000;
const OPEN: readonly ReminderState[] = [
	"scheduled",
	"delivered",
	"acknowledged",
	"unresolved",
];
export const GIVEN: readonly ReminderState[] = [
	"caregiver_confirmed",
	"self_reported_complete",
];

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (at: Date) =>
	`${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;

export const roundDoses = (occurrences: Doses, now: number) => {
	const today = dayKey(new Date(now));
	return occurrences
		.filter(({ occurrence }) => {
			const at = Date.parse(occurrence.scheduledFor);
			return (
				occurrence.kind === "medication" &&
				at <= now + HOUR &&
				(at >= now - 2 * HOUR ||
					(OPEN.includes(occurrence.state) && dayKey(new Date(at)) === today))
			);
		})
		.toSorted(
			(a, b) =>
				Number(b.occurrence.state === "unresolved") -
					Number(a.occurrence.state === "unresolved") ||
				Date.parse(a.occurrence.scheduledFor) -
					Date.parse(b.occurrence.scheduledFor),
		);
};

export const MISSED = "Missed";

const cellText = (
	{ occurrence, events }: Doses[number],
	nameOf: (identity: string) => string,
) => {
	if (occurrence.state === "caregiver_confirmed") {
		const by = events.findLast((e) => e.state === "caregiver_confirmed");
		return by === undefined ? "Given" : nameOf(by.actor);
	}
	if (occurrence.state === "self_reported_complete") return "Self-reported";
	if (occurrence.state === "unresolved") return MISSED;
	if (occurrence.state === "declined") return "Declined";
	return "—";
};

type MarRow = {
	readonly title: string;
	readonly time: string;
	readonly minute: number;
	readonly cells: Record<string, string>;
};

export const marGrid = (
	occurrences: Doses,
	nameOf: (identity: string) => string,
	days = 14,
) => {
	const meds = occurrences.filter((d) => d.occurrence.kind === "medication");
	const dates = [
		...new Set(meds.map((d) => dayKey(new Date(d.occurrence.scheduledFor)))),
	]
		.toSorted()
		.slice(-days);
	const rows = new Map<string, MarRow>();
	for (const dose of meds) {
		const at = new Date(dose.occurrence.scheduledFor);
		const date = dayKey(at);
		if (!dates.includes(date)) continue;
		const time = at.toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});
		const key = `${dose.occurrence.title}\n${time}`;
		const row = rows.get(key) ?? {
			title: dose.occurrence.title,
			time,
			minute: at.getHours() * 60 + at.getMinutes(),
			cells: {},
		};
		rows.set(key, row);
		row.cells[date] ??= cellText(dose, nameOf);
	}
	return {
		dates,
		rows: [...rows.values()].toSorted(
			(a, b) => a.minute - b.minute || a.title.localeCompare(b.title),
		),
	};
};
