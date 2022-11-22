const fs = require(`fs`);
const wasm = fs.readFileSync(require.resolve(`mono-layout/wasm`));

function mainSync() {
    const {createContext} = require(`mono-layout/sync`);

    const context = createContext(wasm);
    const layout = context.createLayout();

    layout.setSource(``);
}

async function mainAsync() {
    const {createContext} = require(`mono-layout/async`);

    const context = await createContext(wasm);
    const layout = context.createLayout();

    layout.setSource(``);
}

mainSync();
mainAsync();
