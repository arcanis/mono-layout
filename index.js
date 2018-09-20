// don't change this line; it must work with brfs
const fs = require('fs');

const setupModule = require(`./lib/text-layout.js`);
const binaryData = fs.readFileSync(`${__dirname}/lib/text-layout.wasm`);

module.exports = new Promise(resolve => {
  setupModule(binaryData, Module => {
    resolve(Module);
  });
});
