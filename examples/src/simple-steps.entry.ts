import {
	registerUpdateReconciler,
	enableHotReload,
	runExportedSteps,
	Steps,
	steps,
} from "../../dist";

enableHotReload({ loggingEnabled: false });
registerUpdateReconciler(module);
runExportedSteps(module, getSteps);

export function getSteps(): Steps {
	return steps(
		{
			id: "start",
			do: async (args, { onUndo }) => {
				console.log("start");
				onUndo(async () => console.log("undo start"));
				return {
					data: 5,
				};
			},
		},
		{
			id: "continue1",
			do: async (args, { onUndo }) => {
				console.log("continue 1");
				onUndo(async () => console.log("undo 1"));
				return {
					data2: 10,
					...args,
				};
			},
		},
		{
			id: "continue2",
			do: async (args, { onUndo }) => {
				console.log("continue 2");
				onUndo(async () => console.log("undo 2"));
				return {};
			},
		}
	);
}
