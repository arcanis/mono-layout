const setupModule = require(`../lib/mono-layout-async`);

const {prepare} = require(`./prepare`);

exports.createContext = async wasmBinary => {
  const lib = prepare(await setupModule({wasmBinary}));

  return {
    createLayout() {
      return new lib.TextLayout();
    },
  };
};
