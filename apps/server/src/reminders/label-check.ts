import type { CareInstruction } from "@health/contracts/care-profile";
import type {
	LabelCheck,
	LabelRead,
	ReminderOccurrence,
} from "@health/contracts/reminders";

const READABLE = 0.7;
const DUE_WINDOW_MS = 60 * 60_000;

const FORM_WORDS = new Set([
	"tablet",
	"tablets",
	"tab",
	"tabs",
	"capsule",
	"capsules",
	"cap",
	"caps",
	"oral",
	"hcl",
	"hydrochloride",
	"er",
	"xr",
	"sr",
	"dr",
	"cr",
	"xl",
	"extended",
	"delayed",
	"release",
	"mg",
	"mcg",
	"ml",
	"g",
	"unit",
	"units",
]);

const words = (text: string) =>
	text
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter((w) => w !== "" && !/^\d/.test(w) && !FORM_WORDS.has(w));

const names = (text: string) =>
	text
		.split(/[()]/)
		.map(words)
		.filter((n) => n.length > 0);

const distance = (a: string, b: string) => {
	let row = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		const next = [i];
		for (let j = 1; j <= b.length; j++)
			next[j] = Math.min(
				(row[j] ?? 0) + 1,
				(next[j - 1] ?? 0) + 1,
				(row[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
			);
		row = next;
	}
	return row[b.length] ?? 0;
};

const close = (a: string, b: string) => {
	const shorter = Math.min(a.length, b.length);
	return distance(a, b) <= (shorter <= 4 ? 0 : shorter >= 10 ? 2 : 1);
};

const covers = (needle: readonly string[], haystack: readonly string[]) =>
	needle.length > 0 && needle.every((n) => haystack.some((h) => close(n, h)));

const strengths = (text: string) =>
	[...text.matchAll(/(\d+(?:\.\d+)?)\s*(mcg|mg|ml|g|units?|%)/gi)].map(
		([, amount, unit]) => `${Number(amount)}${unit?.toLowerCase()}`,
	);

const doseReasons = (occurrence: ReminderOccurrence, now: number) => {
	const reasons: string[] = [];
	if (occurrence.kind !== "medication")
		reasons.push("This reminder is not a medication dose.");
	if (
		occurrence.state === "self_reported_complete" ||
		occurrence.state === "caregiver_confirmed"
	)
		reasons.push("This dose was already given.");
	const early = Date.parse(occurrence.scheduledFor) - now;
	if (Math.abs(early) > DUE_WINDOW_MS)
		reasons.push(
			`This dose is not due now: it is due ${Math.round(Math.abs(early) / 60_000)} minutes ${early > 0 ? "from now" : "ago"}.`,
		);
	return reasons;
};

const strengthReasons = (
	instruction: CareInstruction | undefined,
	strength: string | null,
) => {
	if (instruction === undefined || strength === null) return [];
	const planned = strengths(`${instruction.name} ${instruction.instruction}`);
	return planned.length > 0 &&
		!strengths(strength).every((s) => planned.includes(s))
		? [
				`Label says ${strength}. The care plan says “${instruction.instruction}”.`,
			]
		: [];
};

export const checkLabel = (
	read: LabelRead,
	dose: {
		readonly occurrence: ReminderOccurrence;
		readonly preferredName: string | null;
		readonly allergies: readonly string[] | null;
		readonly instructions: readonly CareInstruction[];
		readonly now: number;
	},
): LabelCheck => {
	const { occurrence } = dose;
	const reasons = doseReasons(occurrence, dose.now);
	const { patientName, drugName } = read;
	if (read.confidence < READABLE || patientName === null || drugName === null)
		return reasons.length > 0
			? { verdict: "mismatch", reasons, read }
			: {
					verdict: "retake",
					reasons: [
						"The label is hard to read. Take the picture again, close up and in good light.",
					],
					read,
				};

	if (dose.preferredName === null)
		reasons.push(
			"No name is saved in the care profile, so the name on the label cannot be checked.",
		);
	else if (
		!covers(
			words(dose.preferredName).filter((w) => w.length > 1),
			words(patientName),
		)
	)
		reasons.push(
			`Label says ${patientName}. This dose is for ${dose.preferredName}.`,
		);

	const titleWords = words(occurrence.title);
	const instruction = dose.instructions.find(
		(i) =>
			i.kind === "medication" &&
			i.verification === "verified" &&
			(i.id === occurrence.subjectId ||
				names(i.name).some((n) => covers(n, titleWords))),
	);
	const labelNames = names(drugName);
	if (
		!labelNames.some(
			(n) =>
				covers(n, titleWords) ||
				(instruction !== undefined && covers(n, words(instruction.name))),
		)
	)
		reasons.push(
			`Label says ${drugName}. This dose is ${instruction?.name ?? occurrence.title}.`,
		);

	reasons.push(...strengthReasons(instruction, read.strength));

	const labelWords = labelNames.flat();
	for (const allergy of dose.allergies ?? [])
		if (names(allergy).some((n) => covers(n, labelWords)))
			reasons.push(`Allergy on file: ${allergy}.`);

	return { verdict: reasons.length > 0 ? "mismatch" : "match", reasons, read };
};
