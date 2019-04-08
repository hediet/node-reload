require("S:\\dev\\easy-attach\\")({
    label: "hot-reload",
    continue: true,
    showUI: false
});

import { enableHotReload, hotRequire } from "../index";

enableHotReload({ loggingEnabled: false });

//import "./manualReconciler";
import "./updateReconcilerDemo";

/*hotRequire<typeof import("./dep")>(module, "./dep", cur => {
    console.log(cur.x);
});
*/
