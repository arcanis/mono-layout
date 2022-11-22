const setupModule = require(`../lib/mono-layout-sync`);

const {prepare} = require(`./prepare`);

exports.createContext = wasmBinary => {
  const lib = prepare(setupModule({wasmBinary}));

  return {
    createLayout() {
      return new lib.TextLayout();
    },
  };
};
