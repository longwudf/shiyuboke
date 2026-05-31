import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type PostSummary = {
  id: string;
  slug: string;
  fileName: string;
  title: string;
  description: string;
  date: string;
  updatedDate: string;
  category: string;
  tags: string[];
  cover: string;
  draft: boolean;
  featured: boolean;
};

type PostDetail = PostSummary & {
  body: string;
};

const emptyPost: PostDetail = {
  id: "",
  slug: "",
  fileName: "",
  title: "",
  description: "",
  date: "",
  updatedDate: "",
  category: "未分类",
  tags: [],
  cover: "",
  draft: true,
  featured: false,
  body: ""
};

const today = () => new Date().toISOString().slice(0, 10);

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";

const api = async <T,>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? "Request failed");
  return payload as T;
};

const markdownToHtml = (markdown: string) => {
  const escape = (value: string) =>
    value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);

  return markdown
    .split(/\n{2,}/)
    .map((block) => {
      const text = block.trim();
      if (!text) return "";
      if (text.startsWith("### ")) return `<h3>${escape(text.slice(4))}</h3>`;
      if (text.startsWith("## ")) return `<h2>${escape(text.slice(3))}</h2>`;
      if (text.startsWith("# ")) return `<h1>${escape(text.slice(2))}</h1>`;
      if (text.startsWith("> ")) return `<blockquote>${escape(text.replace(/^> /gm, ""))}</blockquote>`;
      if (text.startsWith("- ")) {
        return `<ul>${text.split("\n").map((line) => `<li>${escape(line.replace(/^- /, ""))}</li>`).join("")}</ul>`;
      }
      return `<p>${escape(text)}</p>`;
    })
    .join("");
};

function App() {
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<PostDetail>(emptyPost);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [dark, setDark] = useState(() => localStorage.getItem("manager-theme") === "dark");
  const [preview, setPreview] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("manager-theme", dark ? "dark" : "light");
  }, [dark]);

  const loadPosts = async () => {
    const data = await api<{ posts: PostSummary[] }>("/api/posts");
    setPosts(data.posts);
  };

  useEffect(() => {
    loadPosts().catch((error) => setMessage(error.message));
  }, []);

  const categories = useMemo(() => Array.from(new Set(posts.map((post) => post.category))).sort(), [posts]);
  const tags = useMemo(() => Array.from(new Set(posts.flatMap((post) => post.tags))).sort(), [posts]);

  const filteredPosts = posts.filter((post) => {
    const haystack = [post.title, post.description, post.category, post.tags.join(" ")].join(" ").toLowerCase();
    const matchesQuery = query.trim() ? haystack.includes(query.toLowerCase()) : true;
    const matchesStatus = statusFilter === "all" || (statusFilter === "draft" ? post.draft : !post.draft);
    const matchesCategory = categoryFilter === "all" || post.category === categoryFilter;
    const matchesTag = tagFilter === "all" || post.tags.includes(tagFilter);
    return matchesQuery && matchesStatus && matchesCategory && matchesTag;
  });

  const selectPost = async (id: string) => {
    const post = await api<PostDetail>(`/api/posts/${encodeURIComponent(id)}`);
    setSelectedId(id);
    setDraft(post);
    setMessage("");
  };

  const createPost = () => {
    const date = today();
    setSelectedId("");
    setDraft({ ...emptyPost, date, updatedDate: date, body: "## 开始写作\n\n这里写正文。", slug: "" });
    setMessage("正在创建新文章，填写标题后会自动生成 slug。");
  };

  const updateField = <K extends keyof PostDetail>(key: K, value: PostDetail[K]) => {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === "title" && !current.id) next.slug = slugify(String(value));
      return next;
    });
  };

  const savePost = async () => {
    const payload = { ...draft };
    const saved = selectedId
      ? await api<PostDetail>(`/api/posts/${encodeURIComponent(selectedId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
      : await api<PostDetail>("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

    setSelectedId(saved.id);
    setDraft(saved);
    await loadPosts();
    setMessage("已保存文章。");
  };

  const removePost = async () => {
    if (!selectedId || !confirm("删除后会移动到 .trash/posts，确认删除？")) return;
    await api(`/api/posts/${encodeURIComponent(selectedId)}`, { method: "DELETE" });
    setDraft(emptyPost);
    setSelectedId("");
    await loadPosts();
    setMessage("文章已移动到回收站。");
  };

  const publish = async (published: boolean) => {
    if (!selectedId) return;
    const endpoint = published ? "publish" : "unpublish";
    const post = await api<PostDetail>(`/api/posts/${encodeURIComponent(selectedId)}/${endpoint}`, { method: "POST" });
    setDraft(post);
    await loadPosts();
    setMessage(published ? "文章已发布。" : "文章已取消发布。");
  };

  const uploadCover = async (file: File | null) => {
    if (!file) return;
    const form = new FormData();
    form.append("image", file);
    const result = await api<{ path: string }>("/api/images", { method: "POST", body: form });
    updateField("cover", result.path);
    setMessage("封面图已上传。");
  };

  const commitAndPush = async () => {
    const result = await api<{ message: string; output: string }>("/api/git/push", { method: "POST" });
    setMessage(`${result.message}\n${result.output}`);
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div>
            <p className="eyebrow">Local CMS</p>
            <h1>文章管理器</h1>
          </div>
          <button className="icon-button" onClick={() => setDark((value) => !value)} title="切换深色模式">
            {dark ? "☾" : "☀"}
          </button>
        </div>

        <div className="filters">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索文章" />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">全部状态</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
          </select>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">全部分类</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
            <option value="all">全部标签</option>
            {tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
          </select>
        </div>

        <div className="post-list">
          {filteredPosts.map((post) => (
            <button key={post.id} className={`post-item ${post.id === selectedId ? "active" : ""}`} onClick={() => selectPost(post.id)}>
              <span>{post.title || "未命名文章"}</span>
              <small>{post.draft ? "草稿" : "已发布"} · {post.category}</small>
            </button>
          ))}
        </div>
      </aside>

      <section className="editor">
        <header className="toolbar">
          <button onClick={createPost}>新增</button>
          <button className="primary" onClick={savePost}>保存</button>
          <button onClick={() => publish(true)} disabled={!selectedId || !draft.draft}>发布</button>
          <button onClick={() => publish(false)} disabled={!selectedId || draft.draft}>取消发布</button>
          <button className="danger" onClick={removePost} disabled={!selectedId}>删除</button>
          <button onClick={commitAndPush}>提交并推送</button>
        </header>

        {message && <pre className="message">{message}</pre>}

        <div className="editor-grid">
          <div className="form-panel">
            <div className="field-grid">
              <label>标题<input value={draft.title} onChange={(event) => updateField("title", event.target.value)} /></label>
              <label>Slug<input value={draft.slug} onChange={(event) => updateField("slug", slugify(event.target.value))} /></label>
              <label>日期<input type="date" value={draft.date} onChange={(event) => updateField("date", event.target.value)} /></label>
              <label>更新日期<input type="date" value={draft.updatedDate} onChange={(event) => updateField("updatedDate", event.target.value)} /></label>
              <label>分类<input value={draft.category} onChange={(event) => updateField("category", event.target.value)} /></label>
              <label>标签<input value={draft.tags.join(", ")} onChange={(event) => updateField("tags", event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean))} /></label>
            </div>
            <label>描述<textarea rows={3} value={draft.description} onChange={(event) => updateField("description", event.target.value)} /></label>
            <div className="field-grid">
              <label>封面路径<input value={draft.cover} onChange={(event) => updateField("cover", event.target.value)} /></label>
              <label>上传封面<input type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.svg" onChange={(event) => uploadCover(event.target.files?.[0] ?? null)} /></label>
            </div>
            <div className="switches">
              <label><input type="checkbox" checked={draft.draft} onChange={(event) => updateField("draft", event.target.checked)} /> 草稿</label>
              <label><input type="checkbox" checked={draft.featured} onChange={(event) => updateField("featured", event.target.checked)} /> 精选</label>
              <label><input type="checkbox" checked={preview} onChange={(event) => setPreview(event.target.checked)} /> 实时预览</label>
            </div>
            <label>Markdown 正文<textarea className="body-editor" value={draft.body} onChange={(event) => updateField("body", event.target.value)} /></label>
          </div>

          {preview && (
            <div className="preview-panel">
              <p className="eyebrow">Preview</p>
              <article dangerouslySetInnerHTML={{ __html: markdownToHtml(draft.body) }} />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
