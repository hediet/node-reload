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
			do: async (args, { onUndo }) => {
				await slowLog("start");
				onUndo(() => slowLog("undo start"));
				return {
					data: 9,
				};
			},
		},
		{
			id: "continue1",
			do: async (args, { onUndo }) => {
				await slowLog("continue 1");
				onUndo(() => slowLog("undo 1"));
				return { data2: 10, ...args };
			},
		},
		{
			id: "continue2",
			do: async (args, { onUndo }) => {
				await slowLog("continue 2 XX");
				onUndo(() => slowLog("undo 2"));
				return {};
			},
		}
	);
}
