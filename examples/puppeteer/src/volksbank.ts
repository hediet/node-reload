import {
    Steps,
    steps,
    enableHotReload,
    setupControllerForExportedBuilder,
    installUpdateReconciler
} from "../../../dist";
import puppeteer = require("puppeteer");

require("S:\\dev\\easy-attach\\")({
    label: "hot-reload",
    showUI: false,
    continue: true
});

enableHotReload();
installUpdateReconciler(module);
setupControllerForExportedBuilder(module, buildSteps);

export function buildSteps(): Steps<void, void> {
    return steps(
        {
            id: "Setup",
            do: async () => {
                const browser = await puppeteer.launch({
                    slowMo: 100,
                    devtools: true,
                    headless: false
                });
                const page = await browser.newPage();

                return {
                    result: {
                        browser,
                        page
                    },
                    undo: () => browser.close()
                };
            }
        },
        {
            id: "NavigateTo",
            do: async args => {
                console.log("navtoa");
                const page = args.page;
                await page.goto(
                    "https://www.volksbank-brawo.de/banking-private/entry"
                );
                return args;
            }
        },
        {
            id: "Login",
            do: async args => {
                console.log("login");
                const page = args.page;

                const p = await page.waitForSelector("#txtBenutzerkennung");
                await p.type("");

                const pwd = await page.waitForSelector("#pwdPin");
                await pwd.type("");

                (await page.waitForSelector("#xview-anmelden")).click();

                return {
                    result: args,
                    undo: () => page.reload()
                };
            }
        },
        {
            id: "SkipWeiter",
            do: async args => {
                const page = args.page;
                let i = 0;
                while (i < 2) {
                    i++;
                    try {
                        const cont = await page.waitForSelector(
                            "#xview-weiter",
                            {
                                timeout: 3000
                            }
                        );
                        await cont.click();
                    } catch (e) {
                        break;
                    }
                }
                return args;
            }
        },
        {
            id: "ExtractSaldo",
            do: async args => {
                const page = args.page;
                const val = await page.waitForSelector(
                    "#xvwKontoauswahlSaldoValue"
                );
                const valStr = (await page.evaluate(
                    (e: Element) => e.textContent,
                    val
                )) as string;

                const saldo = valStr.trim();

                return args;
            }
        }
    );
}
