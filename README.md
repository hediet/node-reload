# Hot Reloading for NodeJS

[![](https://img.shields.io/twitter/follow/hediet_dev.svg?style=social)](https://twitter.com/intent/follow?screen_name=hediet_dev)

A thoughtfully designed library that brings advanced hot reloading to NodeJS.

## Features

-   Tracks a dependency graph (files in `node_modules` and there like can be ignored).
-   Tracked files are watched for changes.
-   If a file has changed, reconcilers try to apply the change to the running app on a module basis.
-   If a reconciler is not successful, the reconcilers of the dependees are asked to apply the change.

## Usage

### Installation

```
yarn add @hediet/node-reload
```

or

```
npm install @hediet/node-reload --save
```

See the `./examples` folder for detailed examples.
Works best with TypeScript.

### Hot Reload Exported Items

`hotReloadExportedItem` makes it very easy to track changes of exported items.

```ts
import { enableHotReload } from "@hediet/node-reload/node"; // This import needs nodejs.

// Call this before importing modules that should be hot-reloaded!
enableHotReload({
	entryModule: module, // only this module and its transitive dependencies are tracked
	logging: 'debug', // useful for debugging if hot-reload does not work
});

import { hotReloadExportedItem } from "@hediet/node-reload"; // This import is bundler-friendly and works in any environment!
import { myFunction } from './dep1';

const d = hotReloadExportedItem(myFunction, myFunction => {
	// Runs initially and on every change of `myFunction`
    console.log('myFunction: ' + myFunction());
	return {
		dispose: () => {
			console.log('cleanup');
		}
	}
});
// ...
d.dispose();

```

## Similar libs

-   [node-hot](https://github.com/mihe/node-hot): Inspired this library.

## Changelog

-   0.0.2 - Initial release.
-   0.4.2 - Implements Live Debug
-   0.10.0 - Rewrite. Focus on `hotReloadExportedItem` and more portable code.
