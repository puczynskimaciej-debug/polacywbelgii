import { parseMarkdown, stringifyMarkdown } from "./frontmatter.js";

export class ContentRepository {
  constructor(api, paths) {
    this.api = api;
    this.paths = paths;
  }

  async getJson(path) {
    const file = await this.api.read(path);
    return { data: JSON.parse(file.text), sha: file.sha };
  }

  async saveJson(path, data, sha, label) {
    return this.api.writeText(path, `${JSON.stringify(data, null, 2)}\n`, `CMS: aktualizacja ${label}`, sha);
  }

  home() { return this.getJson(this.paths.home); }
  site() { return this.getJson(this.paths.site); }
  saveHome(data, sha) { return this.saveJson(this.paths.home, data, sha, "strony głównej"); }
  saveSite(data, sha) { return this.saveJson(this.paths.site, data, sha, "kontaktu i SEO"); }

  async articles() {
    const files = await this.api.list(this.paths.articles);
    const markdownFiles = files.filter((file) => file.type === "file" && file.name.endsWith(".md"));
    const articles = await Promise.all(markdownFiles.map(async (entry) => {
      const file = await this.api.read(entry.path);
      const parsed = parseMarkdown(file.text);
      return { slug: entry.name.replace(/\.md$/, ""), path: entry.path, sha: entry.sha, ...parsed.data, body: parsed.body };
    }));
    return articles.sort((first, second) => String(second.date).localeCompare(String(first.date)));
  }

  async saveArticle(article, original = null) {
    const slug = original?.slug || slugify(article.slug || article.title);
    if (!slug) throw new Error("Nie można utworzyć adresu artykułu.");
    const path = `${this.paths.articles}/${slug}.md`;
    const { body, slug: ignored, path: ignoredPath, sha: ignoredSha, ...data } = article;
    return this.api.writeText(path, stringifyMarkdown(data, body), `CMS: ${original ? "edycja" : "dodanie"} artykułu „${article.title}”`, original?.sha);
  }

  deleteArticle(article) {
    return this.api.remove(article.path, article.sha, `CMS: usunięcie artykułu „${article.title}”`);
  }

  async media() {
    try {
      const files = await this.api.list(this.paths.media);
      return files.filter((file) => file.type === "file" && /\.(avif|gif|jpe?g|png|webp)$/i.test(file.name));
    } catch (error) {
      if (error.status === 404) return [];
      throw error;
    }
  }

  async upload(file) {
    if (file.size > 4 * 1024 * 1024) throw new Error("Obraz może mieć maksymalnie 4 MB.");
    if (!file.type.startsWith("image/")) throw new Error("Wybrany plik nie jest obrazem.");
    const extension = file.name.match(/\.[A-Za-z0-9]+$/)?.[0].toLowerCase() || "";
    const name = `${Date.now()}-${slugify(file.name.replace(/\.[^.]+$/, ""))}${extension}`;
    const path = `${this.paths.media}/${name}`;
    await this.api.writeBinary(path, new Uint8Array(await file.arrayBuffer()), `CMS: dodanie obrazu ${name}`);
    return { path: `/${path.replace(/^src\//, "").replace(/^Images\//, "images/")}`, name };
  }

  deleteMedia(file) {
    return this.api.remove(file.path, file.sha, `CMS: usunięcie obrazu ${file.name}`);
  }
}

export function slugify(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
}
