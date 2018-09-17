const {readFileSync} = require(`fs`);

const setupModule = require(`./lib/text-layout.js`);
const binaryData = readFileSync(`${__dirname}/lib/text-layout.wasm`);

module.exports = new Promise(resolve => {
  setupModule(binaryData, Module => {
    resolve(Module);
  });
});
