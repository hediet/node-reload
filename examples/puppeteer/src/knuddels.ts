import { 
    Steps, 
    steps, 
    enableHotReload, 
    runExportedSteps, 
    registerUpdateReconciler
} from "@hediet/node-reload";

import puppeteer from "puppeteer";

enableHotReload();
registerUpdateReconciler(module);
runExportedSteps(module, buildSteps);

export function buildSteps(): Steps {
    return steps(
        {
            id: "Setup",
            run: async () => {
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
            run: async (args) => {
                const { page } = args.result;
                await page.goto("https://preview.knuddels.de/"); //aa
                return args;
            }
        },
        {
            id: "Login",
            run: async (args) => {
                const { result } = args;
                const { page } = result;
                console.log("testaaa");
                const s = await page.waitFor("div[data-test-id='lp-view-switch']");
                s.click();

                return {
                    result,
                    undo: async () => page.reload()
                };
            }
        },
        {
            id: "Login2",
            run: async (args) => {
                const { result } = args;
                const { page } = result;
                const s = await page.waitFor("input[data-test-id='login-input-username']");
                await s.type("Hennithing");

                const s2 = await page.waitFor("input[data-test-id='login-input-password']");
                await s2.type("123123123a");

                const btn = await page.waitFor("div[data-test-id='login-button-submit']");
                btn.click();

                // testa

                return {
                    result,
                    undo: async () => {}
                };
            }
        },
        {
            id: "next",
            run: async (args) => {}
        }
    );
}
