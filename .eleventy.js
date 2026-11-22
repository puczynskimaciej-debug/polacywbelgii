module.exports = function (eleventyConfig) {
  const fs = require('node:fs');
  const path = require('node:path');
  eleventyConfig.on('eleventy.before', () => {
    const workspace = path.resolve(__dirname);
    const output = path.resolve(workspace, '_site');
    if (path.dirname(output) !== workspace) throw new Error('Unexpected Eleventy output path');
    for (const name of ['local-demo-order.json', 'local-demo-ads.json', 'demo-assets']) {
      const target = path.resolve(output, name);
      if (path.dirname(target) !== output) throw new Error('Unexpected local demo path');
      fs.rmSync(target, { recursive: name === 'demo-assets', force: true });
    }
    for (const name of ['artykuly/test', 'artykuly/test-praca', 'artykuly/test-weekend', 'images/placeholders']) {
      const target = path.resolve(output, name);
      if (!target.startsWith(output + path.sep)) throw new Error('Unexpected stale test output path');
      fs.rmSync(target, { recursive: true, force: true });
    }
  });
  if (process.env.CONTEXT !== 'production' && !process.env.CF_PAGES) eleventyConfig.setUseGitIgnore(false);
  eleventyConfig.addGlobalData('buildVersion', process.env.CF_PAGES_COMMIT_SHA || process.env.COMMIT_REF || String(Date.now()));
  const markdown = require("markdown-it")({ html: false, linkify: true, typographer: true });
  eleventyConfig.addPassthroughCopy("src/style.css");
  eleventyConfig.addPassthroughCopy("src/robots.txt");
  eleventyConfig.addPassthroughCopy("src/fonts.css");
  eleventyConfig.addPassthroughCopy("src/fonts");
  eleventyConfig.addPassthroughCopy("src/script.js");
  eleventyConfig.addPassthroughCopy("src/region.js");
  eleventyConfig.addPassthroughCopy("src/events.js");
  eleventyConfig.addPassthroughCopy("src/calendar-days.js");
  eleventyConfig.addPassthroughCopy("src/name-days-pl.json");
  eleventyConfig.addPassthroughCopy("src/name-days-short-pl.json");
  eleventyConfig.addPassthroughCopy("src/ad-creative.js");
  eleventyConfig.addPassthroughCopy({ "src/ads.js": "listings.js" });
  eleventyConfig.addPassthroughCopy("src/order-modal.js");
  eleventyConfig.addPassthroughCopy("src/ad-correction.js");
  eleventyConfig.addPassthroughCopy({ "src/ads-i18n.js": "listings-i18n.js" });
  eleventyConfig.addPassthroughCopy({ "src/ads.css": "listings.css" });
  eleventyConfig.addFilter("json", value => JSON.stringify(value));
  eleventyConfig.addFilter("jsjson", value => JSON.stringify(value).replace(/</g, "\\u003c"));
  eleventyConfig.addPassthroughCopy({ "src/Images": "images" });
  eleventyConfig.addPassthroughCopy({ "admin-app": "admin" });
  if (process.env.CONTEXT !== 'production' && !process.env.CF_PAGES && fs.existsSync('.local/demo-order.json')) eleventyConfig.addPassthroughCopy({ '.local/demo-order.json': 'local-demo-order.json' });
  if (process.env.CONTEXT !== 'production' && !process.env.CF_PAGES && fs.existsSync('.local/demo-ads.json')) eleventyConfig.addPassthroughCopy({ '.local/demo-ads.json': 'local-demo-ads.json' });
  if (process.env.CONTEXT !== 'production' && !process.env.CF_PAGES && fs.existsSync('.local/demo-assets')) eleventyConfig.addPassthroughCopy({ '.local/demo-assets': 'demo-assets' });
  eleventyConfig.addFilter("renderMarkdown", (value) => markdown.render(value || ""));

  eleventyConfig.addFilter("readableDate", (value) =>
    new Intl.DateTimeFormat("pl-PL", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Warsaw"
    }).format(new Date(value))
  );

  eleventyConfig.addFilter("limit", (array, amount) =>
    (array || []).slice(0, amount)
  );

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data"
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};
