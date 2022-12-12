const fs = require(`fs`);
const ts = require(`term-strings`);
const glob = require(`glob`);
const vm = require(`vm`);

const wasm = fs.readFileSync(require.resolve(`mono-layout/wasm`));

const {createContext} = require(`mono-layout/sync`);
const {createLayout} = createContext(wasm);

const ok = `${ts.style.color.front(`green`)}✓${ts.style.color.front.out}`;
const ko = `${ts.style.color.front(`red`)}✗${ts.style.color.front.out}`;

class TestSuite {

    constructor() {

        this.tests = [];

    }

    register(label) {

        let test = { label, fn: () => () => {} };
        this.tests.push(test);

        return test;

    }

    run(level = 0) {

        let indent = ` `.repeat(level * 4);

        if (level > 0 && this.tests.length > 0)
            console.log(``);

        for (let test of this.tests) {

            let testsuite = new TestSuite();

            try {
                test.fn(testsuite, makeEnv());
                console.log(`${indent} ${ok} ${test.label}`);
            } catch (err) {
                console.log(`${indent} ${ko} ${test.label} (${err.message || err})`);
            }

            testsuite.run(level + 1);

        }

        if (level > 0 && this.tests.length > 0) {
            console.log(``);
        }

    }

}

function makeEnv() {

    let layout = createLayout();

    let otp = [ '' ];

    function APPLY(patch) {

        otp.splice(patch.startingRow, patch.deletedLineCount, ...Array.from({length: patch.addedLineCount}, (_, n) => layout.getLine(patch.startingRow + n)));

    }

    function SETUP_EMPTY() {

    }

    function SETUP(newStr) {

        str = newStr;

        APPLY(layout.setSource(newStr));

    }

    function RESET() {

        APPLY(layout.applyConfiguration());

    }

    function SET_SOURCE(newStr) {
        
        APPLY(layout.setSource(newStr));

    }

    function SPLICE(start, length, replacement) {

        APPLY(layout.spliceSource(start, length, replacement));

    }

    function APPEND(appendStr) {

        SPLICE(str.length, 0, appendStr);

    }

    function LINE_COUNT() {

        return otp.length;

    }

    function TEXT() {

        return otp.join(`\n`);

    }

    function LINE_SLICE(row, start, end) {

        return layout.getLineSlice(row, start, end);

    }

    function REQUIRE(condition, msg = `Assertion failed!`) {

        if (!condition) {
            throw new Error(msg);
        }

    }

    function ASSERT_EQ(left, right) {

        REQUIRE(JSON.stringify(left) === JSON.stringify(right), `${JSON.stringify(left)} == ${JSON.stringify(right)}`);

    }

    return { layout, SETUP_EMPTY, SETUP, RESET, SET_SOURCE, SPLICE, APPEND, LINE_COUNT, LINE_SLICE, TEXT, REQUIRE, ASSERT_EQ, Position: (x, y) => ({x, y}), PositionRet: (x, y, perfectFit) => [{x, y}, perfectFit] };

}

let testsuite = new TestSuite();

for (let file of glob.sync(`**/*.test.cc`, { cwd: __dirname })) {

    let content = fs.readFileSync(`${__dirname}/${file}`).toString();

    if (!content.includes(`ASSERT`))
        continue;

    content = content.replace(/^[ \t]*#.*/gm, ``);
    content = content.replace(/(TEST_CASE|SECTION)\((.*)\)$/gm, `testsuite.register($2).fn = (testsuite, env) =>`);
    content = content.replace(/FOR\(([^,]+),/g, `for (let $1 of `);
    content = content.replace(/([A-Z][A-Z_]*)\(/g, `env.$1(`);
    content = content.replace(/\b(layout|Position|PositionRet)\b/g, `env.$1`);
    content = content.replace(/([0-9])u/g, `$1`);
    content = content.replace(/\bauto\b/g, `let`);

    testsuite.register(file).fn = testsuite => {
        vm.runInNewContext(content, { console, JSON, testsuite });
    };

}

testsuite.run();
