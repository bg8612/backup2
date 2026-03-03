import fg from "fast-glob";
import { readFile, writeFile } from "node:fs/promises";
import { minify } from "html-minifier-terser";

const DIST = "dist";

// находим ВСЕ html внутри dist (включая подкаталоги)
const htmlFiles = await fg([`${DIST}/**/*.html`], { dot: true });

for (const file of htmlFiles) {
  const input = await readFile(file, "utf8");

  const output = await minify(input, {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeEmptyAttributes: true,

    // безопасные настройки — не трогаем JS/CSS внутри html
    minifyCSS: false,
    minifyJS: false,
  });

  await writeFile(file, output, "utf8");
}

console.log(`Minified HTML files: ${htmlFiles.length}`);
