const fs = require(`fs`);
const wasm = fs.readFileSync(require.resolve(`mono-layout/wasm`));

const {createContext} = require(`mono-layout/sync`);
const {createLayout} = createContext(wasm);

const benchmark = (description, setup, fn) => {
    const loopCount = 100n;
    let totalTime = 0n;

    for (let t = 0n; t < loopCount; ++t) {
        const props = setup();

        const startTime = process.hrtime.bigint();
        fn(props);
        const endTime = process.hrtime.bigint();

        totalTime += endTime - startTime;
    }

    console.log(`${description}\n  ${`${(totalTime) / loopCount}ns`.padStart(12, ` `)}`);
};

const lorem = `
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas ut dignissim eros, vitae sodales erat. Vivamus placerat id ligula ultrices pharetra. Cras sodales eu turpis nec finibus. Vivamus sit amet commodo purus, non pretium lorem. Praesent eget lobortis urna. Vestibulum luctus quam eget odio egestas malesuada. Maecenas ultrices dui ligula, vitae pellentesque tortor sodales et. Nullam ut vestibulum lorem, vel sollicitudin dui. Quisque nisi nisl, blandit sed libero venenatis, lacinia auctor sem. Nulla fermentum auctor elit, sed pulvinar elit ultricies id. Phasellus dui ligula, bibendum vel tincidunt quis, tempor vel augue.

In maximus metus eros, id iaculis erat consectetur vitae. Donec odio urna, auctor vel erat at, semper tempor turpis. Nullam convallis rutrum rutrum. Aenean id commodo nunc. Praesent et cursus magna, ut pharetra enim. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Donec semper ac nisl ac pharetra.

Pellentesque accumsan eget eros rutrum ultrices. Quisque at sem quis justo venenatis fringilla. Maecenas hendrerit elit vitae sollicitudin posuere. Nulla facilisi. Praesent vel enim enim. Mauris ultricies dui a congue rhoncus. Nunc consectetur ipsum pretium volutpat egestas. Quisque eleifend purus urna, sed porttitor ante tincidunt a.

Nullam vehicula arcu ut finibus suscipit. Vestibulum quis vehicula nisi. Aliquam placerat nibh porttitor, blandit ex id, bibendum felis. Aenean et diam quis sem tincidunt tempus quis vitae leo. Quisque sed sapien molestie, sollicitudin velit quis, auctor neque. Maecenas id scelerisque diam. Vivamus tincidunt molestie scelerisque. Vivamus interdum turpis odio, in efficitur leo sodales nec. Nunc ac nunc vehicula, euismod ex eget, dictum urna. Maecenas sed lectus tristique, ullamcorper nisi eu, iaculis turpis. Duis fermentum fermentum tellus nec facilisis. Nunc porttitor tellus id consectetur blandit. Mauris imperdiet est nunc, vitae imperdiet nunc scelerisque at. Nunc gravida sit amet massa scelerisque accumsan.

Aliquam erat volutpat. Sed ac ante nibh. Proin fermentum elementum lectus et viverra. Fusce gravida quam eget libero maximus, ac fermentum purus volutpat. Quisque vulputate justo in ullamcorper luctus. Aenean vestibulum, orci eu condimentum accumsan, diam lorem consequat nibh, interdum consequat mauris lacus faucibus magna. Phasellus tempor tincidunt lorem, eget pellentesque justo. Morbi consequat, mauris id fringilla blandit, felis felis lobortis urna, ac finibus massa nibh sit amet metus. Nam vulputate mauris in luctus sollicitudin. Etiam nisl nisl, semper commodo ligula nec, cursus euismod turpis. Duis euismod nunc id sem consequat, a fermentum arcu facilisis. Duis bibendum neque non metus viverra, eget condimentum magna vestibulum.
`.trim();

const loremUnicode = `
Λορεμ ιπσθμ δολορ σιτ αμετ, περ σιμθλ μολεστιε ει, qθο ιν δολορ cονσθλατθ. Ατ vελ σαεπε δεσερθντ. Νιηιλ ποστεα νο εοσ. Ειθσ αδηθc δοcτθσ vιμ νο, εαμ νε vιδιτ σολθμ γθβεργρεν. Θτ cονσθλατθ γθβεργρεν πρι. Λορεμ ιπσθμ δολορ σιτ αμετ, περ σιμθλ μολεστιε ει, qθο ιν δολορ cονσθλατθ. Ατ vελ σαεπε δεσερθντ. Νιηιλ ποστεα νο εοσ.

Ατ πρι φορενσιβθσ ιντερεσσετ. Εξ περφεcτο πλατονεμ περπετθα ηισ, πραεσεντ τορqθατοσ σιγνιφερθμqθε θτ περ. Αν qθο προπριαε εξπετενδα vολθπτατθμ. Qθο πθρτο cονvενιρε θτ. Cθ vιμ νισλ πατριοqθε δεσερθισσε, θτ ηινc προβο vελ. Ιθστο σcριπτορεμ περ νε, νεc ατ δολορθμ vεριτθσ. Ατ πρι φορενσιβθσ ιντερεσσετ.

Τε cασε μινιμθμ ιθδιcαβιτ ηασ, δεσερθισσε σαδιπσcινγ τε ηασ. Σιτ νοστρο ειρμοδ πραεσεντ νο. Τε εραντ ιισqθε ναμ, εαμ νο qθανδο λεγερε. Σεα διcαντ λθcιλιθσ δισσεντιασ εθ. Ωισι λθδθσ απειριαν νε vελ. Θνθμ οcθρρερετ νο μεα. Τε cασε μινιμθμ ιθδιcαβιτ ηασ, δεσερθισσε σαδιπσcινγ τε ηασ. Σιτ νοστρο ειρμοδ πραεσεντ νο.

Εθμ qθοδ τραcτατοσ σcριπτορεμ εξ. Εθ δθο vοcιβθσ δετραcτο πατριοqθε. Δθισ ελιγενδι σπλενδιδε περ τε, εθμ εα ενιμ διcτα, φερρι απειριαν περ νε. Cθμ εξ σαεπε ομιτταμ, θτ μινιμθμ ιντελλεγαμ εθμ. Νοvθμ vιρισ ερθδιτι vισ εα, αδ μει γραεcι ερθδιτι θλλαμcορπερ. Εθμ qθοδ τραcτατοσ σcριπτορεμ εξ. Εθ δθο vοcιβθσ δετραcτο πατριοqθε.

Ει θσθ μοvετ qθαεστιο. Vελ εα ποπθλο περσεqθερισ, τε εvερτι vολθπτθα προ. Σεδ τεμπορ ινιμιcθσ cονcεπταμ θτ, μελιθσ αλιqθανδο εθ. Ει θσθ μοvετ qθαεστιο. Vελ εα ποπθλο περσεqθερισ, τε εvερτι vολθπτθα προ. Σεδ τεμπορ ινιμιcθσ cονcεπταμ θτ, μελιθσ αλιqθανδο εθ.
`.trim();

benchmark(`Layout a small ascii string`, () => {
    return createLayout();
}, textLayout => {
    textLayout.setSource(`Hello World`);
});

benchmark(`Layout a large ascii text`, () => {
    return createLayout();
}, textLayout => {
    textLayout.setSource(lorem);
});

benchmark(`Segment a large ascii text (${lorem.length} bytes) using Intl.Segmenter`, () => {
    return new Intl.Segmenter(`en`);
}, segmenter => {
    [...segmenter.segment(lorem)];
});

benchmark(`Segment a large ascii text (${lorem.length} bytes) using uni-algo`, () => {
    return createLayout();
}, textLayout => {
    textLayout.setUtf8Source(lorem);
});

benchmark(`Segment a large unicode text (${(new TextEncoder().encode(loremUnicode)).length} bytes) using Intl.Segmenter`, () => {
    return new Intl.Segmenter(`en`);
}, segmenter => {
    [...segmenter.segment(loremUnicode)];
});

benchmark(`Segment a large unicode text (${(new TextEncoder().encode(loremUnicode)).length} bytes) using uni-algo`, () => {
    return createLayout();
}, textLayout => {
    textLayout.setUtf8Source(loremUnicode);
});
