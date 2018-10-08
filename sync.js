const setupModule = require(`./lib/text-layout-sync.js`);

module.exports = setupModule();

if (!module.exports.TextLayout) {
  throw new Error(`Synchronous loading failed`);
}
