import { enableHotReload, hotRequire } from "../index";

enableHotReload({ loggingEnabled: false });

//import "./manualReconciler";
import "./updateReconcilerDemo";

/*hotRequire<typeof import("./dep")>(module, "./dep", cur => {
    console.log(cur.x);
});
*/
