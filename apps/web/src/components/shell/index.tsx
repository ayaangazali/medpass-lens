// The signed-in app's frame (docs: the approved navigation redesign, issue linked in the PR).
// 900 px and wider: one Explorer window with the screen tree on the left and Back in the title bar.
// Narrower: the same window full screen, with Close in the title bar, a taskbar at the bottom, and
// a Start menu that lists the same screens as the tree, in the same order. Both sizes end with the
// same status bar.
import { Button } from "@health/ui/components/button";
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import {
	ArrowLeft,
	LogOut,
	Menu as MenuIcon,
	Monitor,
	Users,
	X,
} from "lucide-react";
import { type RefObject, useRef } from "react";

import { StatusBar } from "@/components/hud/status-footer";
import { useFamily } from "@/lib/family";
import { setSessionToken } from "@/lib/session";
import { setView, useView, type View } from "@/lib/view";

import {
	familyScreens,
	locate,
	pinned,
	type Screen,
	settingsScreen,
	wearerScreens,
} from "./screens";

const START_MENU = "start-menu";

export function Shell() {
	const view = useView();
	const pathname = useLocation({ select: (location) => location.pathname });
	const { screen, tab, up } = locate(pathname, view);
	const { family } = useFamily();
	const startMenu = useRef<HTMLDivElement>(null);
	const signOut = useRef<HTMLDialogElement>(null);
	const Icon = screen?.icon ?? Monitor;
	const title = screen?.label ?? "MedPass Lens";
	const menu = (
		<Menu
			view={view}
			onPick={() => startMenu.current?.hidePopover()}
			onSignOut={() => {
				startMenu.current?.hidePopover();
				signOut.current?.showModal();
			}}
		/>
	);

	return (
		<div data-view={view} className="flex h-svh flex-col bg-background">
			<h1 className="flex min-h-14 shrink-0 items-center gap-2 border-b bg-card px-3 font-semibold text-lg min-[900px]:min-h-12 min-[900px]:px-4 min-[900px]:text-base">
				<Icon aria-hidden className="size-5 shrink-0 text-primary" />
				<span className="min-w-0 flex-1 truncate">
					{screen !== undefined && (
						<span className="hidden font-normal text-muted-foreground min-[900px]:inline">
							MedPass Lens ·{" "}
						</span>
					)}
					{title}
					{tab !== undefined && tab.to !== screen?.to && ` · ${tab.label}`}
				</span>
				{up !== null && (
					<>
						<Link
							to={up}
							className="win95-title-button hidden items-center gap-1 min-[900px]:inline-flex"
						>
							<ArrowLeft aria-hidden className="size-3.5" /> Back
						</Link>
						<Link
							to={up}
							aria-label={`Close ${title}`}
							className="win95-close grid shrink-0 place-items-center min-[900px]:hidden"
						>
							<X aria-hidden className="size-6" />
						</Link>
					</>
				)}
			</h1>

			<div className="flex min-h-0 flex-1">
				<nav
					aria-label="Screens"
					className="hidden w-60 shrink-0 overflow-y-auto border-r bg-card p-2 min-[900px]:block"
				>
					{menu}
				</nav>
				<div className="flex min-w-0 flex-1 flex-col">
					{screen?.tabs !== undefined && (
						<nav
							aria-label={`${screen.label} pages`}
							className="flex shrink-0 gap-1 overflow-x-auto border-b bg-card px-2"
						>
							{screen.tabs.map((t) => (
								<Link
									key={t.to}
									to={t.to}
									activeOptions={{ exact: true }}
									className="win95-sheet-tab"
								>
									{t.label}
								</Link>
							))}
						</nav>
					)}
					<div className="win95-desktop min-h-0 flex-1 overflow-y-auto">
						<Outlet />
					</div>
				</div>
			</div>

			<StatusBar familyId={family?.id ?? null} />

			<nav
				aria-label="Taskbar"
				className="win95-taskbar grid grid-cols-4 gap-1 min-[900px]:hidden"
			>
				<button
					type="button"
					popoverTarget={START_MENU}
					className="win95-tab win95-taskbar-button"
				>
					<MenuIcon aria-hidden className="size-6" />
					Menu
				</button>
				{pinned[view].map((s) => (
					<Link key={s.to} to={s.to} className="win95-tab win95-taskbar-button">
						<s.icon aria-hidden className="size-6" />
						{s.label}
					</Link>
				))}
			</nav>
			<div
				ref={startMenu}
				id={START_MENU}
				popover="auto"
				className="win95-raised win95-start-menu"
			>
				<div className="min-w-0 flex-1 overflow-y-auto p-1">{menu}</div>
			</div>

			<SignOutDialog ref={signOut} />
		</div>
	);
}

/** Asks before it signs out of Telly on this device. Open it with `ref.current.showModal()`. */
export function SignOutDialog({
	ref,
}: {
	ref: RefObject<HTMLDialogElement | null>;
}) {
	return (
		<dialog
			ref={ref}
			aria-labelledby="sign-out-title"
			className="win95-raised win95-window m-auto w-[min(22rem,calc(100vw-2rem))] border-0 p-1.5 text-foreground backdrop:bg-black/30"
		>
			<h2
				id="sign-out-title"
				className="win95-titlebar flex items-center gap-1.5 px-1.5 py-1 text-sm"
			>
				<LogOut aria-hidden className="size-4" /> Sign out
			</h2>
			<form method="dialog" className="grid gap-3 p-3 text-sm">
				<p>Sign out of MedPass Lens on this device?</p>
				<div className="grid grid-cols-2 gap-2">
					<Button
						type="submit"
						className="win95-primary"
						onClick={() => setSessionToken(null)}
					>
						Sign out
					</Button>
					<Button type="submit" autoFocus>
						Cancel
					</Button>
				</div>
			</form>
		</dialog>
	);
}

/**
 * The screen list: the desktop tree and the phone Start menu. In the wearer view, the view switch
 * and Sign out are in Settings instead (captain), so the wearer cannot leave by accident.
 */
function Menu({
	view,
	onPick,
	onSignOut,
}: {
	view: View;
	onPick: () => void;
	onSignOut: () => void;
}) {
	if (view === "wearer")
		return (
			<ul className="grid">
				<li>
					<p className="win95-menu-head">For me</p>
					<ul>
						{wearerScreens.map((s) => (
							<li key={s.to}>
								<MenuLink screen={s} onPick={onPick} />
							</li>
						))}
					</ul>
					<hr />
				</li>
				<li>
					<MenuLink screen={settingsScreen} onPick={onPick} />
				</li>
			</ul>
		);
	return (
		<ul className="grid">
			{(
				[
					["Family", familyScreens],
					["For me", wearerScreens],
				] as const
			).map(([label, screens]) => (
				<li key={label}>
					<p className="win95-menu-head">{label}</p>
					<ul>
						{screens.map((s) => (
							<li key={s.to}>
								<MenuLink screen={s} onPick={onPick} />
							</li>
						))}
					</ul>
					<hr />
				</li>
			))}
			<li>
				<button
					type="button"
					className="win95-menu-item w-full"
					onClick={() => {
						setView("wearer");
						onPick();
					}}
				>
					<Users aria-hidden className="size-5" />
					Switch to wearer view
				</button>
			</li>
			<li>
				<MenuLink screen={settingsScreen} onPick={onPick} />
				<hr />
			</li>
			<li>
				<button
					type="button"
					className="win95-menu-item w-full"
					onClick={onSignOut}
				>
					<LogOut aria-hidden className="size-5" />
					Sign out…
				</button>
			</li>
		</ul>
	);
}

function MenuLink({ screen, onPick }: { screen: Screen; onPick: () => void }) {
	return (
		<Link to={screen.to} className="win95-menu-item" onClick={onPick}>
			<screen.icon aria-hidden className="size-5" />
			{screen.label}
		</Link>
	);
}
