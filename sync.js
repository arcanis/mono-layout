// don't change this line; it must work with brfs
const fs = require('fs');

const setupModule = require(`./lib/text-layout-sync.js`);
const binaryData = fs.readFileSync(`${__dirname}/lib/text-layout-sync.wasm`);

module.exports = setupModule(binaryData);

if (!module.exports.TextLayout) {
  throw new Error(`Synchronous loading failed`);
}
