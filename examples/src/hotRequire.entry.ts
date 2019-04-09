import { enableHotReload, hotRequire } from "../../dist";

enableHotReload({ loggingEnabled: false });

hotRequire<typeof import("./dep")>(module, "./dep", cur => {
	console.log(cur.x);
});
