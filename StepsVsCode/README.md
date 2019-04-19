# Hot Reloading for NodeJS - Step Execution State Visualizer

[![](https://img.shields.io/twitter/follow/hediet_dev.svg?style=social)](https://twitter.com/intent/follow?screen_name=hediet_dev)

This is the vscode extension for `@hediet/node-reload`.

It displays the current executation state when **simply debugging**
a nodejs application that uses the step execution controller
(see `runExportedSteps`).

## Example

If you have this typescript code:

```ts
enableHotReload();
registerUpdateReconciler(module);
runExportedSteps(module, getSteps);

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
```

And debug it using vscode and having this extension installed, you can see the executation state of each step:

![Execution state](./StepsVsCode/docs/demo-vscode-steps1.gif)

You can also run a specific step:

![Move to step](./StepsVsCode/docs/demo-vscode-steps2.gif)

## How does it work

When debugging a node application using the `node` or `node2` debug adapter,
this extension launches an RPC server and instructs the debugee to connect to it.

The debugee then sends the current execution state of all steps
whenether anything changes to the extension.
