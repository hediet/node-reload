import {
    Steps,
    steps,
    enableHotReload,
    setupControllerForExportedBuilder,
    installUpdateReconciler
} from "@hediet/node-reload";
import puppeteer = require("puppeteer");

enableHotReload();
installUpdateReconciler(module);
setupControllerForExportedBuilder(module, buildSteps);

export function buildSteps(): Steps<void, void> {
    return steps(
        {
            id: "Setup",
            do: async () => {
                const browser = await puppeteer.launch({
                    slowMo: 10,
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
                const page = args.page;
                await page.goto(
                    "https://preview.knuddels.de/"
                ); //aa
                return args;
            }
        },
        {
            id: "Login",
            do: async args => {
                const page = args.page;
                console.log("testaaa");
                const s = await page.waitFor("div[data-test-id='lp-view-switch']");
                s.click();

                return {
                    result: args,
                    undo: async () => page.reload()
                };
            }
        },
        {
            id: "Login2",
            do: async args => {
                const page = args.page;
                const s = await page.waitFor("input[data-test-id='login-input-username']");
                await s.type("Hennithing");

                const s2 = await page.waitFor("input[data-test-id='login-input-password']");
                await s2.type("123123123a");

                const btn = await page.waitFor("div[data-test-id='login-button-submit']");
                btn.click();

                // testa

                return {
                    result: args,
                    undo: async () => {

                    }
                };
            }
        },
        {
            id: "next",
            do: async args =>  {

            }
        }
    );
}
