// Mirrors wrangler's Text rules for src templates under bun test:
// importing an element/layout .html file yields its source as a string
// default export. Templates are vanilla HTML rendered server-side by the
// expander; they are never fetched by browsers.
Bun.plugin({
  name: "html-text",
  setup(build) {
    build.onLoad({ filter: /[.]html$/ }, async (args) => ({
      contents: `export default ${JSON.stringify(await Bun.file(args.path).text())};`,
      loader: "js",
    }));
  },
});
