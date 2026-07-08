const text = "Das ist öko and öl. usage of usa. de in the code. heizöl is good.";

const keywords = ["öko", "öl", "usa", "de", "heizöl"];

for (const k of keywords) {
    const reg = new RegExp(`(^|\\W)${k}(?=\\W|$)`, 'i');
    console.log(k, reg.test(text));
}
