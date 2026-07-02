const text = "Heizöl is good. Fernwärme is hot.";

const keywords = ["heizöl", "fernwärme"];

for (const k of keywords) {
    const reg = new RegExp(`\\b${k}\\b`, 'i');
    console.log(k, reg.test(text));
}
