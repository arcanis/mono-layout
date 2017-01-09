module.exports = function (bind, lib) {

    class Patch {

        constructor(startingRow, deletedLineCount, addedLineStrings) {

            this.startingRow = startingRow;
            this.deletedLineCount = deletedLineCount;
            this.addedLineStrings = addedLineStrings;

        }

        apply(targetArray) {

            targetArray.splice(this.startingRow, this.deletedLineCount, ... this.addedLineStrings);

        }

        toString() {

            return `<Patch#+${this.addedLineStrings.length}-${this.deletedLineCount}@${this.startingRow}>`;

        }

    }

    class Position {

        constructor(x, y) {

            this.x = x;
            this.y = y;

        }

        fromJS(expose) {

            expose(this.x, this.y);

        }

        toString() {

            return `<Position#${this.x}:${this.y}>`;

        }

    }

    class TextLayout extends lib.TextLayout {

        setColumns(columns) {

            return super.setColumns(Math.min(columns, 0xFFFFFFFF));

        }

        getPositionAbove(position, amplitude = 1) {

            return super.getPositionAbove(position, amplitude);

        }

        getPositionBelow(position, amplitude = 1) {

            return super.getPositionBelow(position, amplitude);

        }

        setOptions(options) {

            return Object.keys(options).reduce((needsReset, optionName) => {

                let methodName = `set${optionName[0].toUpperCase()}${optionName.substr(1)}`;

                if (!this[methodName])
                    throw new Error(`Invalid option "${optionName}"`);

                return this[methodName](options[optionName]) || needsReset;

            }, false);

        }

    }

    bind(`Patch`, Patch);
    bind(`Position`, Position);

    return { Patch, Position, TextLayout };

};
