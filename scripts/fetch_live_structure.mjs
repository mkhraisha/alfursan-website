import https from "https";

function fetch(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          return fetch(res.headers.location).then(resolve).catch(reject);
        }
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(data));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

const html = await fetch("https://alfursanauto.ca/loan-calculator/");

// Header
const headerMatch = html.match(/<header[\s\S]*?<\/header>/);
console.log("=== HEADER ===");
console.log(headerMatch?.[0]?.substring(0, 3000) || "No header found");

// Footer
const footerMatch = html.match(/<footer[\s\S]*?<\/footer>/);
console.log("\n=== FOOTER ===");
console.log(footerMatch?.[0]?.substring(0, 3000) || "No footer found");

// Font links
const fontMatches = html.match(/<link[^>]*font[^>]*>/gi);
console.log("\n=== FONT LINKS ===");
console.log(fontMatches?.join("\n") || "No font links found");

// Body tag
const bodyMatch = html.match(/<body[^>]*>/);
console.log("\n=== BODY TAG ===");
console.log(bodyMatch?.[0] || "No body tag found");

// Inline styles / style tags (first few)
const styleMatches = html.match(/<style[^>]*>[\s\S]*?<\/style>/g);
console.log(
  "\n=== STYLE TAGS (count: " + (styleMatches?.length || 0) + ") ===",
);
styleMatches?.slice(0, 3).forEach((s, i) => {
  console.log(`\n--- Style block ${i + 1} (first 2000 chars) ---`);
  console.log(s.substring(0, 2000));
});

// CSS link tags
const cssLinks = html.match(/<link[^>]*stylesheet[^>]*>/gi);
console.log("\n=== CSS LINKS ===");
console.log(cssLinks?.join("\n") || "No CSS links found");

// Main content structure
const mainMatch = html.match(/<main[\s\S]*?<\/main>/);
console.log("\n=== MAIN CONTENT (truncated) ===");
console.log(mainMatch?.[0]?.substring(0, 2000) || "No main found");

// Page title area between header and calculator
const titleArea = html.match(/loan.calculator[\s\S]{0,2000}/i);
console.log("\n=== LOAN CALCULATOR CONTENT AREA ===");
console.log(titleArea?.[0]?.substring(0, 2000) || "Not found");
