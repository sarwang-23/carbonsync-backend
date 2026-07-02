const text = "This is a test invoice with usage and region code: DE. Cost is $100.";

function findSignalsIncludes(text: string, keywords: string[]) {
    return keywords.filter((keyword) => text.toLowerCase().includes(keyword.toLowerCase()));
}

function findSignalsBoundary(text: string, keywords: string[]) {
    return keywords.filter((keyword) => {
        const lowerKeyword = keyword.toLowerCase();
        if (/^[a-z0-9\s]+$/.test(lowerKeyword)) {
            return new RegExp(`\\b${lowerKeyword}\\b`, 'i').test(text);
        } else {
            return text.toLowerCase().includes(lowerKeyword);
        }
    });
}

const kw = ["usa", "de", "$", "rs.", "vat id", "strom"];

console.log("Includes:", findSignalsIncludes(text, kw));
console.log("Boundary:", findSignalsBoundary(text, kw));
