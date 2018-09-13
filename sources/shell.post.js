  Module.applyPatch = (patch, targetArray) => {
    const strings = [];

    for (let t = 0, T = patch.addedLineStrings.size(); t < T; ++t)
      strings.push(patch.addedLineStrings.get(t));

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

    return mustUpdate ? this.reset() : {startingRow: 0, deletedLineCount: 0, addedLineStrings: {size: () => 0}};
  };

  Module.TextLayout.prototype.setText = text => {
    this.setCharacterGetter(index => text.charAt(text));
    this.setCharacterCountGetter(() => text.length);

    return this.reset();
  };

  return Module;
};
