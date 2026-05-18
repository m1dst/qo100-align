import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { minify as minifyHtml } from "html-minifier-terser";
import CleanCSS from "clean-css";
import { minify as minifyJs } from "terser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, "src");
const distDir = path.join(__dirname, "dist");

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatBuildStamp(now = new Date()) {
  const yyyy = now.getFullYear();
  const mm = pad2(now.getMonth() + 1);
  const dd = pad2(now.getDate());
  const hh = pad2(now.getHours());
  const min = pad2(now.getMinutes());
  const buildId = `${yyyy}${mm}${dd}-${hh}${min}`;

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const buildDate = `${now.getDate()} ${months[now.getMonth()]} ${yyyy}`;
  return { buildId, buildDate };
}

async function main() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  const [htmlRaw, cssRaw, jsRaw] = await Promise.all([
    readFile(path.join(srcDir, "index.html"), "utf8"),
    readFile(path.join(srcDir, "styles.css"), "utf8"),
    readFile(path.join(srcDir, "app.js"), "utf8")
  ]);

  const cssOut = new CleanCSS({ level: 2 }).minify(cssRaw);
  if (cssOut.errors.length) {
    throw new Error(`CSS minify failed: ${cssOut.errors.join("; ")}`);
  }

  const jsOut = await minifyJs(jsRaw, {
    compress: true,
    mangle: true,
    format: { comments: false }
  });
  if (!jsOut.code) {
    throw new Error("JS minify failed");
  }

  const htmlOut = await minifyHtml(htmlRaw, {
    collapseWhitespace: true,
    removeComments: true,
    minifyCSS: false,
    minifyJS: false,
    removeRedundantAttributes: true,
    removeEmptyAttributes: true
  });

  const { buildId, buildDate } = formatBuildStamp(new Date());
  const htmlFinal = htmlOut
    .replaceAll("__BUILD_ID__", buildId)
    .replaceAll("__BUILD_DATE__", buildDate)
    .replace('href="./styles.css"', `href="./styles.css?v=${buildId}"`)
    .replace('src="./app.js"', `src="./app.js?v=${buildId}"`);

  await Promise.all([
    writeFile(path.join(distDir, "styles.css"), cssOut.styles, "utf8"),
    writeFile(path.join(distDir, "app.js"), jsOut.code, "utf8"),
    writeFile(path.join(distDir, "index.html"), htmlFinal, "utf8")
  ]);

  console.log("Build complete: dist/index.html, dist/styles.css, dist/app.js");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
