const { hotReloadExportedItem } = require('../../');
const { enableHotReload } = require('../../dist/node');

enableHotReload({ entryModule: module, logging: 'debug' });

const dep1 = require('./dep1');

hotReloadExportedItem(dep1.myFunction, f => {
    console.log('myFunction: ' + f());
});

setInterval(() => {}, 10000);
