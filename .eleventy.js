module.exports = function (eleventyConfig) {
  const fs = require('node:fs');
  eleventyConfig.addGlobalData('buildVersion', process.env.CF_PAGES_COMMIT_SHA || process.env.COMMIT_REF || String(Date.now()));
  const markdown = require("markdown-it")({ html: false, linkify: true, typographer: true });
  eleventyConfig.addPassthroughCopy("src/style.css");
  eleventyConfig.addPassthroughCopy("src/script.js");
  eleventyConfig.addPassthroughCopy("src/region.js");
  eleventyConfig.addPassthroughCopy({ "src/ads.js": "listings.js" });
  eleventyConfig.addPassthroughCopy("src/order-modal.js");
  eleventyConfig.addPassthroughCopy({ "src/ads-i18n.js": "listings-i18n.js" });
  eleventyConfig.addPassthroughCopy({ "src/ads.css": "listings.css" });
  eleventyConfig.addFilter("json", value => JSON.stringify(value));
  eleventyConfig.addFilter("jsjson", value => JSON.stringify(value).replace(/</g, "\\u003c"));
  eleventyConfig.addPassthroughCopy({ "src/Images": "images" });
  eleventyConfig.addPassthroughCopy({ "admin-app": "admin" });
  if (process.env.CONTEXT !== 'production' && !process.env.CF_PAGES && fs.existsSync('.local/demo-ads.json')) {
    eleventyConfig.addPassthroughCopy({ '.local/demo-ads.json': 'local-demo-ads.json' });
    eleventyConfig.addPassthroughCopy({ '.local/demo-assets': 'demo-assets' });
  }
  if (process.env.CONTEXT !== 'production' && !process.env.CF_PAGES && fs.existsSync('.local/demo-order.json')) eleventyConfig.addPassthroughCopy({ '.local/demo-order.json': 'local-demo-order.json' });
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
