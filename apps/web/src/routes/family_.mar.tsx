import type { Family } from "@health/contracts";
import { ReminderHistory } from "@health/contracts/reminders";
import { Button } from "@health/ui/components/button";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList, Printer } from "lucide-react";
import { createPortal } from "react-dom";

import { FamilyGate } from "@/components/family/parts";
import { Page } from "@/components/hud/window";
import { MISSED, marGrid } from "@/components/reminders/medpass";
import { ApiNotice } from "@/components/win95";
import { familyPath, useApi } from "@/lib/api";
import { loadFamilyReads, useFamily } from "@/lib/family";
import { useMemberNames } from "@/lib/members";

export const Route = createFileRoute("/family_/mar")({
	loader: loadFamilyReads((familyId) => [
		[ReminderHistory, familyPath(familyId, "/reminder-occurrences")],
	]),
	component: FamilyMar,
});

function FamilyMar() {
	const { state, family } = useFamily();
	return (
		<Page
			title={`Med record · ${family?.name ?? "No person"}`}
			icon={ClipboardList}
			className="max-w-6xl"
		>
			<FamilyGate
				data={{ familyState: state, family }}
				emptyClassName="p-3 text-sm"
			>
				{(chosen) => <Record family={chosen} />}
			</FamilyGate>
		</Page>
	);
}

function Record({ family }: { family: Family }) {
	const history = useApi(
		ReminderHistory,
		familyPath(family.id, "/reminder-occurrences"),
	);
	const { nameOf } = useMemberNames(family.id);
	if (history.kind !== "ready")
		return <ApiNotice state={history} what="the medication record" />;
	const sheet = (
		<Sheet
			name={family.name}
			grid={marGrid(history.value.occurrences, nameOf)}
		/>
	);
	return (
		<div className="grid min-h-0 flex-1 content-start gap-2 overflow-auto p-2 text-sm">
			<Button
				className="h-11 justify-self-start"
				onClick={() => window.print()}
				type="button"
			>
				<Printer aria-hidden />
				Print
			</Button>
			{sheet}
			{createPortal(
				<div className="hidden bg-white p-4 text-black print:block print:[body:has(&)>#app]:hidden">
					{sheet}
				</div>,
				document.body,
			)}
		</div>
	);
}

const dateLabel = (key: string) =>
	new Date(`${key}T00:00`).toLocaleDateString([], {
		month: "short",
		day: "numeric",
	});

function Sheet({
	name,
	grid,
}: {
	name: string;
	grid: ReturnType<typeof marGrid>;
}) {
	return (
		<section className="grid gap-2">
			<h3 className="font-bold">MedPass Lens medication record · {name}</h3>
			{grid.rows.length === 0 ? (
				<p>No medication doses recorded yet.</p>
			) : (
				<div className="overflow-x-auto print:overflow-visible">
					<table className="w-full border-collapse text-xs">
						<thead>
							<tr>
								<th scope="col" className="border border-current p-1 text-left">
									Medication
								</th>
								{grid.dates.map((date) => (
									<th
										key={date}
										scope="col"
										className="border border-current p-1"
									>
										{dateLabel(date)}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{grid.rows.map((row) => (
								<tr key={`${row.title} ${row.time}`}>
									<th
										scope="row"
										className="border border-current p-1 text-left"
									>
										{row.title}
										<br />
										{row.time}
									</th>
									{grid.dates.map((date) => (
										<td
											key={date}
											className={`border border-current p-1 text-center ${row.cells[date] === MISSED ? "font-bold text-red-700" : ""}`}
										>
											{row.cells[date] ?? "—"}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			<p className="text-xs">
				A name means that person confirmed the dose was given. Missed means no
				one confirmed it.
			</p>
		</section>
	);
}
