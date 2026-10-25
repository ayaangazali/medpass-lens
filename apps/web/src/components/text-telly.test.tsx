import "./test/setup";

import { expect, test } from "bun:test";
import { fireEvent, installDom, render, serve, waitFor } from "./test/dom";
import { TextTellyButton, tellyVCard } from "./text-telly";

installDom();

test("the contact card is a vCard named MedPass Lens with the line's number", () => {
	expect(tellyVCard("+14155951440")).toBe(
		"BEGIN:VCARD\r\nVERSION:3.0\r\nN:;MedPass Lens;;;\r\nFN:MedPass Lens\r\nTEL;TYPE=CELL:+14155951440\r\nEND:VCARD\r\n",
	);
});

test("the dialog shows the number with Message MedPass Lens and Add to Contacts", async () => {
	serve({
		"GET /api/text-telly": {
			json: { tellyNumber: "+14155951440", myPhone: null },
		},
	});
	const view = render(<TextTellyButton />);
	fireEvent.click(view.getByRole("button", { name: "Text MedPass Lens" }));
	await waitFor(() => view.getByText("+1 (415) 595-1440"));
	view.getByText(/Save your phone number in Settings first/);
	expect(
		view
			.getByRole("link", { name: "Message MedPass Lens" })
			.getAttribute("href"),
	).toBe("sms:+14155951440?&body=Hi%20Telly");
	const card = view.getByRole("link", { name: "Add to Contacts" });
	expect(card.getAttribute("download")).toBe("Telly.vcf");
	expect(decodeURIComponent(card.getAttribute("href") ?? "")).toBe(
		`data:text/vcard;charset=utf-8,${tellyVCard("+14155951440")}`,
	);
});

test("without a MedPass Lens line the dialog says so", async () => {
	serve({
		"GET /api/text-telly": { json: { tellyNumber: null, myPhone: null } },
	});
	const view = render(<TextTellyButton />);
	await waitFor(() =>
		view.getByText("Texting MedPass Lens is not set up on this server."),
	);
	expect(view.queryByText("Message MedPass Lens")).toBeNull();
});
