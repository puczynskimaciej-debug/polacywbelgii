module.exports = function (eleventyConfig) {
  const markdown = require("markdown-it")({ html: false, linkify: true, typographer: true });
  eleventyConfig.addPassthroughCopy("src/style.css");
  eleventyConfig.addPassthroughCopy("src/script.js");
  eleventyConfig.addPassthroughCopy("src/ads.js");
  eleventyConfig.addPassthroughCopy("src/order-modal.js");
  eleventyConfig.addPassthroughCopy("src/ads-i18n.js");
  eleventyConfig.addPassthroughCopy("src/ads.css");
  eleventyConfig.addFilter("json", value => JSON.stringify(value));
  eleventyConfig.addFilter("jsjson", value => JSON.stringify(value).replace(/</g, "\\u003c"));
  eleventyConfig.addPassthroughCopy({ "src/Images": "images" });
  eleventyConfig.addPassthroughCopy({ "admin-app": "admin" });
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
