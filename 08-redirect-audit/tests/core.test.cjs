const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../lib/core.js");

test("normalizes, deduplicates and classifies links", () => {
  const page = "https://example.com/start";
  const links = core.dedupeLinks([
    { href: "/about#team", text: "About" },
    { href: "https://example.com/about", text: "Duplicate" },
    { href: "http://external.test/x", text: "External" },
    { href: "mailto:a@example.com", text: "Email" }
  ], page);

  assert.equal(links.length, 2);
  assert.equal(links[0].url, "https://example.com/about");
  assert.equal(links[0].internal, true);
  assert.equal(links[1].internal, false);
  assert.equal(links[1].insecure, true);
});

test("flags broken links, chains and healthy responses", () => {
  assert.deepEqual(core.issueFlags({ status: 404, redirects: 0 }), ["broken"]);
  assert.deepEqual(core.issueFlags({ status: 200, redirects: 2 }), ["redirect-chain"]);
  assert.deepEqual(core.issueFlags({ status: 200, redirects: 0 }), ["ok"]);
});

test("exports CSV safely", () => {
  const csv = core.resultsToCsv([{ url: "https://example.com/a?x=1,2", status: 301, finalUrl: "https://example.com/b", redirects: 1, internal: true, text: 'A "link"' }]);
  assert.match(csv, /"https:\/\/example\.com\/a\?x=1,2"/);
  assert.match(csv, /redirect/);
  assert.match(csv, /"A ""link"""/);
});
