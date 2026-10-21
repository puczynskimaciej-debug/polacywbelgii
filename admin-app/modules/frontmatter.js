export function parseMarkdown(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: source };
  const data = {};
  const lines = match[1].split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const field = lines[index].match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!field) continue;
    const [, key, raw = ""] = field;
    if (raw === "|") {
      const block = [];
      while (lines[index + 1]?.startsWith("  ")) block.push(lines[++index].slice(2));
      data[key] = block.join("\n");
    } else {
      data[key] = parseScalar(raw);
    }
  }
  return { data, body: match[2].trim() };
}

export function stringifyMarkdown(data, body) {
  const preferredOrder = ["title", "title_en", "title_nl", "title_fr", "date", "category", "description", "description_en", "description_nl", "description_fr", "image", "body_en", "body_nl", "body_fr"];
  const keys = [...preferredOrder.filter((key) => data[key] !== undefined && data[key] !== ""), ...Object.keys(data).filter((key) => !preferredOrder.includes(key) && data[key] !== undefined && data[key] !== "")];
  const yaml = keys.map((key) => {
    const value = data[key];
    if (typeof value === "string" && value.includes("\n")) {
      return `${key}: |\n${value.split("\n").map((line) => `  ${line}`).join("\n")}`;
    }
    return `${key}: ${JSON.stringify(value)}`;
  }).join("\n");
  return `---\n${yaml}\n---\n${String(body || "").trim()}\n`;
}

function parseScalar(value) {
  if (!value) return "";
  try { return JSON.parse(value); } catch { return value; }
}
