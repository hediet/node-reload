import {
	registerUpdateReconciler,
	enableHotReload,
	runExportedSteps,
	Steps,
	steps,
} from "../../dist";
import { wait } from "@hediet/std/timer";

enableHotReload({ loggingEnabled: false });
registerUpdateReconciler(module);
runExportedSteps(module, getSteps);

export async function slowLog(text: string) {
	await wait(1000);
	console.log(text);
}

export function getSteps(): Steps {
	return steps(
		{
			id: "start",
			run: async (args, { onRewind }) => {
				await slowLog("start");
				onRewind(() => slowLog("undo start"));
				return { data: 9 };
			},
		},
		{
			id: "continue1",
			run: async (args, { onRewind }) => {
				await slowLog("continue 1");
				onRewind(() => slowLog("undo 1"));
				return { data2: 10, ...args };
			},
		},
		{
			id: "continue2",
			run: async (args, { onRewind }) => {
				await slowLog("continue 2");
				onRewind(() => slowLog("undo 2"));
				return {};
			},
		}
	);
}
