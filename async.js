const setupModule = require(`./lib/text-layout.js`);

module.exports = new Promise(resolve => {
  setupModule(Module => {
    resolve(Module);
  });
});
