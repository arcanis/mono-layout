module.exports = function (bind, lib) {

    function toPosition(position) {

        if (position instanceof Position)
            return position;

        return new Position(position.x, position.y);

    }

    function toChar(c) {

        if (typeof c === `string`)
            c = c.codePointAt(0);

        return c;

    }

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

        setCharacterGetter(fn) {

            if (typeof fn === `function`)
                fn = (orig => (... args) => toChar(orig(... args)))(fn);

            return super.setCharacterGetter(fn);

        }

        setColumns(columns) {

            return super.setColumns(Math.min(columns, 0xFFFFFFFF));

        }

        getFixedPosition(position) {

            return super.getFixedPosition(toPosition(position));

        }

        getPositionLeft(position) {

            return super.getPositionLeft(toPosition(position));

        }

        getPositionRight(position) {

            return super.getPositionRight(toPosition(position));

        }

        getPositionAbove(position, amplitude = 1) {

            return super.getPositionAbove(toPosition(position), amplitude);

        }

        getPositionBelow(position, amplitude = 1) {

            return super.getPositionBelow(toPosition(position), amplitude);

        }

        getCharacterIndexForPosition(position) {

            return super.getCharacterIndexForPosition(toPosition(position));

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
