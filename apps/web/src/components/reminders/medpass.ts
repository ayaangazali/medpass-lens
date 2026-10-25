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
