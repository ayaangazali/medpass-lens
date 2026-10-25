import { CareProfileRecord } from "@health/contracts/care-profile";
import type { FamilyList } from "@health/contracts/families";
import { ReminderHistory } from "@health/contracts/reminders";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Pill } from "lucide-react";

import { Page } from "@/components/hud/window";
import { LabelScan, STATE_TEXT } from "@/components/reminders/history";
import { GIVEN, roundDoses } from "@/components/reminders/medpass";
import { ApiNotice } from "@/components/win95";
import { familyPath, useApi } from "@/lib/api";
import { useFamily } from "@/lib/family";

export const Route = createFileRoute("/rounds")({ component: Rounds });

function Rounds() {
	const { state } = useFamily();
	return (
		<Page title="Med pass" icon={Pill} className="max-w-4xl">
			<div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto p-2 text-sm">
				{state.kind !== "ready" ? (
					<ApiNotice state={state} what="your residents" />
				) : state.value.families.length === 0 ? (
					<p>
						No resident is set up with this account yet.{" "}
						<Link to="/welcome">Set up a person</Link>
					</p>
				) : (
					state.value.families.map((family) => (
						<Resident key={family.id} family={family} />
					))
				)}
			</div>
		</Page>
	);
}

function Resident({ family }: { family: FamilyList["families"][number] }) {
	const profile = useApi(
		CareProfileRecord,
		familyPath(family.id, "/care-profile"),
	);
	const history = useApi(
		ReminderHistory,
		familyPath(family.id, "/reminder-occurrences"),
		{ pollMs: 15_000 },
	);
	const name =
		(profile.kind === "ready" ? profile.value.profile.preferredName : null) ??
		family.name;
	const doses =
		history.kind === "ready"
			? roundDoses(history.value.occurrences, Date.now())
			: [];
	return (
		<section aria-labelledby={`resident-${family.id}`} className="grid gap-2">
			<h3 id={`resident-${family.id}`} className="font-bold">
				{name}
			</h3>
			<div className="win95-inset grid gap-3 bg-card p-2">
				{history.kind !== "ready" ? (
					<ApiNotice state={history} what="doses" />
				) : doses.length === 0 ? (
					<p>No doses due now.</p>
				) : (
					doses.map(({ occurrence }) => {
						const missed = occurrence.state === "unresolved";
						return (
							<article
								key={occurrence.id}
								className={`grid gap-1 ${missed ? "rounded-md border-2 border-red-700 bg-red-50 p-2 text-red-900 dark:border-red-500 dark:bg-red-950 dark:text-red-100" : ""}`}
							>
								<h4 className="font-bold">
									{occurrence.title}
									{" · "}
									<time dateTime={occurrence.scheduledFor}>
										{new Date(occurrence.scheduledFor).toLocaleTimeString([], {
											hour: "2-digit",
											minute: "2-digit",
										})}
									</time>
									{" · "}
									{missed ? "Missed" : STATE_TEXT[occurrence.state]}
								</h4>
								{!GIVEN.includes(occurrence.state) && (
									<LabelScan familyId={family.id} occurrence={occurrence} />
								)}
							</article>
						);
					})
				)}
			</div>
		</section>
	);
}
