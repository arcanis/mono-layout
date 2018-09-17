let setup = false;

module.exports = (wasmBinary, readyCallback) => {
  if (setup) return Module;
  setup = true;

  Module.wasmBinary = wasmBinary;

  Module.onRuntimeInitialized = () => {
    Module.applyPatch = (textLayout, patch, targetArray) => {
      if (!patch)
        return;

      const strings = [];

      for (let t = 0, T = patch.addedLineCount; t < T; ++t)
        strings.push(textLayout.getLineString(patch.startingRow + t));

      targetArray.splice(patch.startingRow, patch.deletedLineCount, ... strings);
    };

    Module.TextLayout.prototype.setConfiguration = config => {
      let mustUpdate = false;

      for (const key of Object.keys(config)) {
        const setter = `set${key.charAt(0).toUpperCase()}${key.substr(1)}`;

        if (!this[setter])
          throw new Error(`Invalid configuration option "${key}"`);

        if (this[setter](config[key])) {
          mustUpdate = true;
        }
      }

      return mustUpdate ? this.reset() : null;
    };

    Module.TextLayout.prototype[Symbol.iterator] = function* () {
      for (let t = 0, T = this.getRowCount(); t < T; ++t) {
        yield this.getLineString(t);
      }
    };

    readyCallback(Module);
  };
