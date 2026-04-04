import https from "https";
import http from "http";

function fetch(url) {
  const mod = url.startsWith("https") ? https : http;
  return new Promise((resolve, reject) => {
    mod
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

// Get the entire page content between header and footer
// The Vehica theme uses specific section structure
const contentArea = html.match(/vehica-app vehica-header[\s\S]*$/);
// Find elementor sections
const elementorSections = html.match(/elementor-section[\s\S]{0,500}/g);
console.log("=== ELEMENTOR SECTIONS (first 5) ===");
elementorSections?.slice(0, 5).forEach((s, i) => {
  console.log(`\n--- Section ${i + 1} ---`);
  console.log(s.substring(0, 500));
});

// Find the loan calculator form area
const calcArea = html.match(/vehica-loan-calculator[\s\S]{0,5000}/i);
console.log("\n=== LOAN CALCULATOR AREA ===");
console.log(calcArea?.[0]?.substring(0, 3000) || "Not found");

// Also look for the page wrapper structure
const wrapper = html.match(/vehica-content[\s\S]{0,1000}/i);
console.log("\n=== VEHICA CONTENT WRAPPER ===");
console.log(wrapper?.[0]?.substring(0, 1000) || "Not found");

// Look for the page heading/hero area
const heroArea = html.match(/Loan Calculator[\s\S]{0,3000}/);
console.log("\n=== HEADING/HERO AREA ===");
console.log(heroArea?.[0]?.substring(0, 3000) || "Not found");

// Get the vehica theme CSS for global layout
console.log("\n=== FETCHING VEHICA THEME CSS ===");
try {
  const themeCss = await fetch(
    "https://alfursanauto.ca/wp-content/themes/vehica/style.css?ver=1.0.99",
  );
  // Extract header-related styles
  const headerStyles = themeCss.match(/\.vehica-header[\s\S]{0,2000}/g);
  console.log("\n--- Header styles (first 2 matches) ---");
  headerStyles?.slice(0, 2).forEach((s, i) => {
    console.log(s.substring(0, 800));
  });

  // Extract footer styles
  const footerStyles = themeCss.match(/vehica-footer[\s\S]{0,1000}/g);
  console.log("\n--- Footer styles (first 2 matches) ---");
  footerStyles?.slice(0, 2).forEach((s, i) => {
    console.log(s.substring(0, 500));
  });

  // Extract menu/nav font styles
  const menuStyles = themeCss.match(/vehica-menu[\s\S]{0,500}/g);
  console.log("\n--- Menu/nav styles (first 3 matches) ---");
  menuStyles?.slice(0, 3).forEach((s, i) => {
    console.log(s.substring(0, 400));
  });

  // Extract body/global styles
  const bodyStyles = themeCss.match(/body[\s\S]{0,500}/);
  console.log("\n--- Body styles ---");
  console.log(bodyStyles?.[0]?.substring(0, 500) || "Not found");
} catch (e) {
  console.log("Failed to fetch theme CSS:", e.message);
}
