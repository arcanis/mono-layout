const {readFileSync} = require(`fs`);

const setupModule = require(`./lib/text-layout-sync.js`);
const binaryData = readFileSync(`./lib/text-layout-sync.wasm`);

module.exports = setupModule(binaryData);
