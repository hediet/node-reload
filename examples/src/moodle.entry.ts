import {
	Steps,
	steps,
	enableHotReload,
	runExportedSteps,
	registerUpdateReconciler,
} from "../../dist";
import puppeteer = require("puppeteer");
import { liveLog } from "@hediet/live-debug";

enableHotReload();
registerUpdateReconciler(module);
runExportedSteps(module, getSteps);

export function getSteps(): Steps {
	return steps(
		{
			id: "Setup",
			run: async (args, { onRewind }) => {
				const browser = await puppeteer.launch({
					slowMo: 10,
					headless: false,
					args: ["--lang=en-US,en"],
				});
				const page = await browser.newPage();

				onRewind(() => browser.close());

				return {
					browser,
					page,
				};
			},
		},
		{
			id: "Login",
			run: async args => {
				const page = args.page;
				await page.deleteCookie(...(await page.cookies()));
				await page.goto("https://demo.moodle.net/login/index.php");
				await page.waitForSelector("#username");
				await page.type("#username", "admin");
				await page.type("#password", "sandbox");
				await page.$eval("#login", form =>
					(form as HTMLFormElement).submit()
				);

				return args;
			},
		},
		{
			id: "OpenCalendarAndOpenNewEvent",
			run: async args => {
				const page = args.page;
				await page.goto(
					"https://demo.moodle.net/calendar/view.php?view=month"
				);
				await page.click("[data-action='new-event-button']");
				return args;
			},
		},
		{
			id: "FillNewEventData",
			run: async args => {
				const page = args.page;
				await page.waitFor("#id_name");
				await page.click("#id_name", { clickCount: 3 });
				await page.type("#id_name", "Dummy Event");
				await page.type("#id_timestart_day", "17");
				await page.type("#id_timestart_month", "Jan");
				return args;
			},
		},
		{
			id: "SaveNewEventData",
			run: async args => {
				const page = args.page;
				await page.click("[data-action='save']");
				return args;
			},
		}
	);
}
