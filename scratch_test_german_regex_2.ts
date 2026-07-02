const text = "Das ist öko and öl.";

const keywords = ["öko", "öl", "strom", "vat id"];

for (const k of keywords) {
    const reg = new RegExp(`\\b${k}\\b`, 'i');
    console.log(k, reg.test(text));
}
