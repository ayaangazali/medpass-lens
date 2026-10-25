import { expect, test } from "bun:test";
import { setupDom } from "@/lib/test/dom";

setupDom();
// Dynamic: `setupDom()` must register `document` and mock `@/env` before React and the app load.
const { fireEvent, waitFor } = await import("@testing-library/react");
const { FAMILY, json, renderRoute, screen, serve, signIn } = await import(
	"@/lib/test/app"
);

const OTHER = { ...FAMILY, id: "fam-2", name: "Grandpa Joe" };

test("the address picks this tab's person over the device default, and screens keep it", async () => {
	signIn();
	localStorage.setItem("telly.family", "fam-1");
	serve({ "GET /api/families": { families: [FAMILY, OTHER] } });
	const { router } = renderRoute("/family/trends?person=fam-2");

	const picker = () =>
		screen.getByRole<HTMLSelectElement>("combobox", { name: "Person" });
	await waitFor(() => expect(picker().value).toBe("fam-2"));

	fireEvent.change(picker(), { target: { value: "fam-1" } });
	await waitFor(() => expect(picker().value).toBe("fam-1"));
	await waitFor(() =>
		expect(router.state.location.search).toEqual({ person: "fam-1" }),
	);

	await router.navigate({ to: "/family" });
	expect(router.state.location.search).toEqual({ person: "fam-1" });
});

test("a join link made for one person is gone after switching to another", async () => {
	signIn();
	serve({
		"GET /api/families": { families: [FAMILY, OTHER] },
		"POST /api/families/fam-1/invites": json(201, {
			code: "for-fam-1",
			expiresAt: "2026-10-11T00:00:00.000Z",
		}),
	});
	renderRoute("/family?person=fam-1");
	fireEvent.click(
		await screen.findByRole("button", { name: "Invite someone" }),
	);
	const link = `${location.origin}/join/for-fam-1`;
	expect(await screen.findByText(link)).toBeTruthy();

	fireEvent.change(screen.getByRole("combobox", { name: "Person" }), {
		target: { value: "fam-2" },
	});
	expect(
		await screen.findByRole("heading", { name: "Family · Grandpa Joe" }),
	).toBeTruthy();
	expect(screen.queryByText(link)).toBeNull();
});
