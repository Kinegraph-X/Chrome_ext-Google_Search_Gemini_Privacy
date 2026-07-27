const rules = [
  "^https?://[^/]+/search\\?([^#]*&)?udm=",
  
];

console.log("verify_regex.js loaded");

(async () => {
  const results = [];
  for (const r of rules) {
    try {
      const res = await chrome.declarativeNetRequest.isRegexSupported({ regex: r, isCaseSensitive: false });
      results.push({ regex: r.slice(0, 40) + "...", ...res });
    } catch (err) {
      results.push({ regex: r.slice(0, 40) + "...", error: String(err) });
    }
  }
  console.log("isRegexSupported results:", results);
  document.getElementById("out").textContent = JSON.stringify(results, null, 2);
})();
