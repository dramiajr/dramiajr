const fs = require("fs");
const path = require("path");

const USERNAME = "dramiajr";
const OUTPUT_PATH = path.join(__dirname, "../profile/top-languages.svg");

const TOKEN = process.env.GITHUB_TOKEN;

const COLORS = {
  Python: "#3776AB",
  JavaScript: "#F1E05A",
  TypeScript: "#3178C6",
  HTML: "#E34C26",
  CSS: "#563D7C",
  Shell: "#89E051",
  Bash: "#89E051",
  Dockerfile: "#384D54",
  SQL: "#E38C00",
  PLpgSQL: "#336791",
  default: "#58A6FF",
};

const IGNORE_LANGS = new Set([
  "Jupyter Notebook",
]);

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function githubFetch(url) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "dramiajr-profile-stats",
  };

  if (TOKEN) {
    headers.Authorization = `Bearer ${TOKEN}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${url}\n${body}`);
  }

  return response.json();
}

async function getRepos() {
  const repos = [];
  let page = 1;

  while (true) {
    const url = `https://api.github.com/users/${USERNAME}/repos?per_page=100&page=${page}&type=owner&sort=updated`;
    const data = await githubFetch(url);

    if (!Array.isArray(data) || data.length === 0) {
      break;
    }

    const usableRepos = data.filter((repo) => {
      return !repo.fork && !repo.archived && !repo.private;
    });

    repos.push(...usableRepos);

    if (data.length < 100) {
      break;
    }

    page += 1;
  }

  return repos;
}

async function getLanguageTotals(repos) {
  const totals = {};

  for (const repo of repos) {
    const languagesUrl = `https://api.github.com/repos/${USERNAME}/${repo.name}/languages`;

    try {
      const languages = await githubFetch(languagesUrl);

      for (const [language, bytes] of Object.entries(languages)) {
        if (IGNORE_LANGS.has(language)) continue;
        totals[language] = (totals[language] || 0) + bytes;
      }
    } catch (error) {
      console.warn(`Skipping ${repo.name}: ${error.message}`);
    }
  }

  return totals;
}

function buildRows(languageTotals) {
  const sorted = Object.entries(languageTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (sorted.length === 0) {
    return `
  <text x="24" y="112" fill="#8B949E" font-family="Segoe UI, Ubuntu, sans-serif" font-size="13">
    No public language data found yet.
  </text>`;
  }

  const totalBytes = sorted.reduce((sum, [, bytes]) => sum + bytes, 0) || 1;

  const rowStartY = 92;
  const rowGap = 30;
  const barX = 132;
  const barMaxWidth = 210;

  return sorted
    .map(([language, bytes], index) => {
      const percent = Math.round((bytes / totalBytes) * 100);
      const barWidth = Math.max(8, Math.round((percent / 100) * barMaxWidth));
      const y = rowStartY + index * rowGap;
      const color = COLORS[language] || COLORS.default;

      return `
  <text x="24" y="${y}" fill="#C9D1D9" font-family="Segoe UI, Ubuntu, sans-serif" font-size="13">${escapeXml(language)}</text>
  <rect x="${barX}" y="${y - 10}" width="${barMaxWidth}" height="9" rx="4.5" fill="#21262D"/>
  <rect x="${barX}" y="${y - 10}" width="${barWidth}" height="9" rx="4.5" fill="${color}"/>
  <text x="365" y="${y}" fill="#8B949E" font-family="Segoe UI, Ubuntu, sans-serif" font-size="12">${percent}%</text>`;
    })
    .join("");
}

function buildSvg(languageTotals) {
  const width = 440;
  const height = 245;
  const rows = buildRows(languageTotals);

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="14" fill="#0D1117"/>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="13.5" stroke="#30363D"/>

  <text x="24" y="36" fill="#F0F6FC" font-family="Segoe UI, Ubuntu, sans-serif" font-size="18" font-weight="700">
    Project Language Mix
  </text>

  <text x="24" y="58" fill="#8B949E" font-family="Segoe UI, Ubuntu, sans-serif" font-size="12">
    Based on public repositories
  </text>
  ${rows}

  <text x="24" y="222" fill="#8B949E" font-family="Segoe UI, Ubuntu, sans-serif" font-size="12">
    Networking • Automation • Linux • Internal Tools
  </text>
</svg>
`;
}

async function main() {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });

  const repos = await getRepos();
  console.log(`Found ${repos.length} public, non-fork, non-archived repos.`);

  const languageTotals = await getLanguageTotals(repos);
  const svg = buildSvg(languageTotals);

  fs.writeFileSync(OUTPUT_PATH, svg, "utf8");

  console.log(`Generated ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
