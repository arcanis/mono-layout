const {readFileSync} = require(`fs`);

const setupModule = require(`./lib/text-layout.js`);
const binaryData = readFileSync(`${__dirname}/text-layout.wasm`);

module.exports = new Promise((resolve, reject) => {
  setupModule(binaryData).then(Module => {
    resolve(Module);
  }, error => {
    reject(error);
  });
});
