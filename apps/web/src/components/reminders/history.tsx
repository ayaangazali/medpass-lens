// The family's reminder history (#28): each due occurrence with every recorded step, in order, with
// who recorded it, from which device, and the person's own words.
import {
	LabelCheck,
	type ReminderEvent,
	ReminderHistory,
	type ReminderOccurrence,
	ReminderOccurrenceDetail,
	type ReminderState,
} from "@health/contracts/reminders";
import { Button } from "@health/ui/components/button";
import { Camera } from "lucide-react";
import { useRef, useState } from "react";

import { failureText } from "@/components/chat/logic";
import { capture } from "@/components/wearer/medicine-check";
import { ApiNotice } from "@/components/win95";
import { type ApiResult, apiRequest, familyPath, useApi } from "@/lib/api";
import { memberLabel } from "@/lib/members";

const SHOWN = 10;

// "Seen" never reads as "done": only the two completion states say the task happened, and they say whose word it is.
export const STATE_TEXT: Record<ReminderState, string> = {
	scheduled: "Scheduled",
	delivered: "Shown",
	acknowledged: "Seen, not done",
	self_reported_complete: "Done, by their own report",
	caregiver_confirmed: "Confirmed by a caregiver",
	deferred: "Put off",
	declined: "Declined",
	unresolved: "Unresolved",
};

const when = (iso: string) =>
	new Date(iso).toLocaleString([], {
		weekday: "short",
		hour: "2-digit",
		minute: "2-digit",
	});

function EventLine({ event, me }: { event: ReminderEvent; me: string | null }) {
	const who =
		event.actor === "scheduler" ? "Scheduler" : memberLabel(event.actor, me);
	return (
		<li className="break-words">
			<time dateTime={event.at}>{when(event.at)}</time>
			{" · "}
			<b>{STATE_TEXT[event.state]}</b>
			{` · ${who}`}
			{event.source === "scheduler" ? "" : ` (${event.source})`}
			{event.wording === null ? "" : ` · “${event.wording}”`}
		</li>
	);
}

/** The newest occurrences already due; the rest are still ahead. */
const dueNow = (occurrences: ReminderHistory["occurrences"]) =>
	occurrences
		.filter(
			(d) =>
				Date.parse(d.occurrence.scheduledFor) <=
				Date.now() + (d.occurrence.kind === "medication" ? 60 * 60_000 : 0),
		)
		.slice(0, SHOWN);

export function ReminderHistorySection({
	familyId,
	me,
}: {
	familyId: string;
	me: string | null;
}) {
	const state = useApi(
		ReminderHistory,
		familyPath(familyId, "/reminder-occurrences"),
		{ pollMs: 15_000 },
	);
	const due = state.kind === "ready" ? dueNow(state.value.occurrences) : [];
	if (state.kind === "ready" && due.length === 0) return null;
	return (
		<section aria-labelledby="reminders" className="grid gap-2">
			<h3 id="reminders" className="font-bold">
				Reminders due
			</h3>
			<div className="win95-inset grid gap-3 bg-card p-2">
				{state.kind !== "ready" ? (
					<ApiNotice state={state} what="reminders" />
				) : (
					<ReminderList familyId={familyId} occurrences={due} me={me} />
				)}
			</div>
		</section>
	);
}

const VERDICT = {
	match: {
		title: "Matches",
		tone: "border-green-700 bg-green-50 text-green-900 dark:border-green-500 dark:bg-green-950 dark:text-green-100",
	},
	mismatch: {
		title: "Does not match. Do not give this dose.",
		tone: "border-red-700 bg-red-50 text-red-900 dark:border-red-500 dark:bg-red-950 dark:text-red-100",
	},
	retake: {
		title: "Take the picture again",
		tone: "border-amber-600 bg-amber-50 text-amber-900 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-100",
	},
} as const;

function LabelScan({
	familyId,
	occurrence,
}: {
	familyId: string;
	occurrence: ReminderOccurrence;
}) {
	const input = useRef<HTMLInputElement>(null);
	const [result, setResult] = useState<
		ApiResult<LabelCheck> | { kind: "checking" } | null
	>(null);
	const send = async (file: File) => {
		setResult({ kind: "checking" });
		setGiven(null);
		const bitmap = await createImageBitmap(file).catch(() => null);
		const frame = bitmap === null ? null : capture(bitmap);
		bitmap?.close();
		if (frame === null)
			return setResult({
				kind: "error",
				message: "I can't read this photo. Take a new photo.",
			});
		setResult(
			await apiRequest(
				LabelCheck,
				familyPath(
					familyId,
					`/reminder-occurrences/${encodeURIComponent(occurrence.id)}/label-check`,
				),
				{
					method: "POST",
					body: { image: { type: "image/jpeg", data: frame.data } },
				},
			),
		);
	};
	const [given, setGiven] = useState<
		ApiResult<ReminderOccurrenceDetail> | { kind: "saving" } | null
	>(null);
	const markGiven = async (check: LabelCheck) => {
		setGiven({ kind: "saving" });
		setGiven(
			await apiRequest(
				ReminderOccurrenceDetail,
				familyPath(
					familyId,
					`/reminder-occurrences/${encodeURIComponent(occurrence.id)}/confirmations`,
				),
				{
					method: "POST",
					body: {
						clientId: crypto.randomUUID(),
						source: "web",
						wording: `Label matched: ${check.read.drugName} for ${check.read.patientName}`,
					},
				},
			),
		);
	};
	const verdict =
		result?.kind === "ready" ? VERDICT[result.value.verdict] : null;
	return (
		<div className="grid gap-1">
			<Button
				className="h-11 justify-self-start"
				disabled={result?.kind === "checking"}
				onClick={() => input.current?.click()}
				type="button"
			>
				<Camera aria-hidden />
				Scan label
			</Button>
			<input
				accept="image/*"
				aria-label={`Photo of the pharmacy label for ${occurrence.title}`}
				capture="environment"
				className="hidden"
				onChange={(event) => {
					const file = event.currentTarget.files?.[0];
					event.currentTarget.value = "";
					if (file !== undefined) void send(file);
				}}
				ref={input}
				type="file"
			/>
			{result?.kind === "checking" && <p role="status">Checking the label…</p>}
			{result?.kind === "ready" && verdict !== null && (
				<div
					className={`grid gap-1 rounded-md border-2 p-2 ${verdict.tone}`}
					role="alert"
				>
					<p className="font-bold">{verdict.title}</p>
					{result.value.verdict === "match" && (
						<p>
							{result.value.read.drugName} for {result.value.read.patientName}
						</p>
					)}
					<ul className="list-disc pl-5">
						{result.value.reasons.map((reason) => (
							<li key={reason}>{reason}</li>
						))}
					</ul>
					{result.value.verdict === "match" &&
						(given?.kind === "ready" ? (
							<p role="status">Recorded as given.</p>
						) : (
							<Button
								className="win95-primary h-11 justify-self-start"
								disabled={given?.kind === "saving"}
								onClick={() => void markGiven(result.value)}
								type="button"
							>
								Mark given
							</Button>
						))}
					{given !== null &&
						given.kind !== "saving" &&
						given.kind !== "ready" && (
							<p className="break-words" role="alert">
								{failureText(given)}
							</p>
						)}
				</div>
			)}
			{result !== null &&
				result.kind !== "checking" &&
				result.kind !== "ready" && (
					<p className="break-words text-destructive" role="alert">
						{failureText(result)}
					</p>
				)}
		</div>
	);
}

function ReminderList({
	familyId,
	occurrences,
	me,
}: {
	familyId: string;
	occurrences: ReminderHistory["occurrences"];
	me: string | null;
}) {
	return occurrences.map(({ occurrence, events }) => (
		<article key={occurrence.id} className="grid gap-1">
			<h4 className="font-bold">
				{occurrence.title}
				{" · "}
				<time dateTime={occurrence.scheduledFor}>
					{when(occurrence.scheduledFor)}
				</time>
				{" · "}
				{STATE_TEXT[occurrence.state]}
			</h4>
			<ol className="grid list-decimal gap-0.5 pl-6">
				{events.map((event) => (
					<EventLine key={event.id} event={event} me={me} />
				))}
			</ol>
			{occurrence.kind === "medication" && (
				<LabelScan familyId={familyId} occurrence={occurrence} />
			)}
		</article>
	));
}
