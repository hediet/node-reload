import { Steps, steps, registerUpdateReconciler } from "..";
import { runExportedSteps } from "../steps";

registerUpdateReconciler(module);

/*
export class Test {
    constructor() {
        console.log("constructor");
    }
}

hotRequireExportedItem(module, Test, Test => {
    new Test();
});


export function foo(arg: string) {
    console.log(arg + "hall");
}

if (getReloadCount(module) === 0) {
    let i = 0;
    useExportedItemAndUpdateOnReload(module, foo, foo => {
        console.log(foo.toString());
        foo("test" + i++);
    });
}
*/

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
