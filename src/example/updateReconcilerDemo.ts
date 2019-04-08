import {
    Controller,
    Steps,
    steps,
    installUpdateReconciler,
    useExportedItemAndUpdateOnReload,
    getReloadCount
} from "..";

installUpdateReconciler(module);

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

export function buildSteps(): Steps<void, void> {
    return steps(
        {
            id: "start",
            do: async args => {
                console.log("start");
                return {
                    result: { data: 4 },
                    undo: async () => {
                        console.log("undo start");
                    }
                };
            }
        },
        {
            id: "continue1",
            do: async args => {
                console.log("continue 1");
                return {
                    result: {
                        data2: 10,
                        ...args
                    },
                    undo: async () => {
                        console.log("undo continue 1b");
                    }
                };
            }
        },
        {
            id: "continue2",
            do: async args => {
                console.log("continue 2");
                return {
                    result: {},
                    undo: async () => {
                        console.log("undo continue 2");
                    }
                };
            }
        }
    );
}

if (getReloadCount(module) === 0) {
    const controller = new Controller<void, void>();
    useExportedItemAndUpdateOnReload(module, buildSteps, buildSteps => {
        controller.applyNewSteps(buildSteps());
    });
}
