import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(ROOT, "package.json"));
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } = require("recharts");
const h = React.createElement;
const directory = resolve(process.argv[2]);
const result = JSON.parse(await readFile(join(directory, "independent-verification.json"), "utf8"));

async function chart(data, { name, title, category, vertical = false, subtitle }) {
  const width = 1100;
  const height = vertical ? 650 : 520;
  const margin = { top: 85, bottom: 65, left: vertical ? 20 : 45, right: 70 };
  const markup = renderToStaticMarkup(
    h(
      BarChart,
      { width, height, data, margin, layout: vertical ? "vertical" : "horizontal", barGap: 4 },
      h(CartesianGrid, {
        strokeDasharray: "3 3",
        stroke: "#dbe3eb",
        horizontal: !vertical,
        vertical,
      }),
      h(
        XAxis,
        vertical
          ? { type: "number", domain: [0, "auto"], stroke: "#475569" }
          : { dataKey: category, stroke: "#475569" },
      ),
      h(
        YAxis,
        vertical
          ? { dataKey: category, type: "category", width: 270, stroke: "#475569" }
          : { domain: [0, "auto"], stroke: "#475569" },
      ),
      h(
        Bar,
        { dataKey: "baseline", fill: "#64748b", isAnimationActive: false, maxBarSize: 36 },
        h(LabelList, {
          dataKey: "baseline",
          position: vertical ? "right" : "top",
          formatter: (v) => v.toFixed(1),
          fill: "#334155",
          fontSize: 12,
        }),
      ),
      h(
        Bar,
        { dataKey: "candidate", fill: "#0f766e", isAnimationActive: false, maxBarSize: 36 },
        h(LabelList, {
          dataKey: "candidate",
          position: vertical ? "right" : "top",
          formatter: (v) => v.toFixed(1),
          fill: "#115e59",
          fontSize: 12,
        }),
      ),
    ),
  );
  let svg = markup.match(/<svg\b[\s\S]*?<\/svg>/)?.[0];
  if (!svg || !svg.includes("recharts-bar-rectangle"))
    throw new Error("Chart did not render data bars");
  if (!svg.includes("xmlns="))
    svg = svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
  const annotation = `<title>${title}</title><rect x="0" y="0" width="1100" height="65" fill="white"/><text x="30" y="27" fill="#0f172a" font-size="20" font-weight="bold">${title}</text><text x="30" y="50" fill="#475569" font-size="13">${subtitle}</text><rect x="30" y="${height - 28}" width="14" height="12" fill="#64748b"/><text x="50" y="${height - 17}" font-size="13" fill="#334155">Baseline</text><rect x="155" y="${height - 28}" width="14" height="12" fill="#0f766e"/><text x="175" y="${height - 17}" font-size="13" fill="#334155">Statement-level role lookup</text><text x="650" y="${height - 17}" font-size="13" fill="#334155">p95 HTTP duration (ms); lower is faster</text>`;
  svg = svg.replace("</svg>", annotation + "</svg>");
  await writeFile(join(directory, name), svg);
}

await chart(
  Array.from({ length: 5 }, (_, i) => ({
    pair: `Pair ${i + 1}`,
    baseline: result.rows.find((r) => r.pair === i + 1 && r.variant === "baseline").p95_ms,
    candidate: result.rows.find((r) => r.pair === i + 1 && r.variant === "candidate").p95_ms,
  })),
  {
    name: "latency-pairs.svg",
    title: "ferrixOps: all five paired measurements",
    category: "pair",
    subtitle:
      "10,000 synthetic expenses · 20 virtual clients · 5 minutes per measurement · identical query contracts",
  },
);

await chart(
  Object.entries(result.query_median_p95)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([query, values]) => ({ query, ...values })),
  {
    name: "latency-query-classes.svg",
    title: "ferrixOps: query-class tradeoffs",
    category: "query",
    vertical: true,
    subtitle:
      "Median of five run-level p95 values per query class; all nine declared classes shown",
  },
);
console.log("Rendered both evidence charts using the repository's Recharts dependency.");
