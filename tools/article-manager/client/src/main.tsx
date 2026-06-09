import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FileText,
  FolderKanban,
  GitBranch,
  Home,
  Image,
  Link2,
  ListChecks,
  Moon,
  Plus,
  RefreshCcw,
  Rocket,
  Save,
  Search,
  Settings,
  Sun,
  Trash2,
  Upload
} from "lucide-react";
import "./styles.css";

type View = "dashboard" | "posts" | "projects" | "friends" | "resources" | "pages" | "media" | "publish";

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
  series?: string;
  seriesOrder?: number;
  cover: string;
  draft: boolean;
  featured: boolean;
};

type PostDetail = PostSummary & {
  body: string;
};

type LinkItem = {
  href: string;
  label: string;
  external?: boolean;
  variant?: string;
};

type DeploymentConfig = {
  repository: string;
  repositoryUrl: string;
  remoteUrl: string;
  sshRemoteUrl: string;
  pagesUrl: string;
  homepageUrl: string;
  actionsUrl: string;
  latestSuccessfulRunUrl: string;
  defaultBranch: string;
  pagesStatus: string;
  discussionsEnabled: boolean;
};

type CommentsConfig = {
  provider: "giscus";
  enabled: boolean;
  giscus: {
    repo: string;
    repoId: string;
    category: string;
    categoryId: string;
    mapping: string;
    strict: string;
    reactionsEnabled: string;
    inputPosition: string;
    theme: string;
    lang: string;
  };
};

type SiteContent = {
  brand: {
    name: string;
    shortName: string;
    author: string;
    tagline: string;
    title: string;
    description: string;
    email: string;
    profileUrl: string;
    avatar: string;
  };
  deployment: DeploymentConfig;
  comments: CommentsConfig;
  navigation: LinkItem[];
  footerLinks: LinkItem[];
  home: {
    eyebrow: string;
    headline: string;
    intro: string;
    actions: LinkItem[];
    socialLinks: LinkItem[];
    now: { label: string; title: string; description: string };
    featured: { label: string; title: string; linkLabel: string };
    latest: { label: string; title: string; linkLabel: string };
    projects: {
      label: string;
      title: string;
      description: string;
      actionLabel: string;
      cards: Array<{ label: string; title: string; description: string }>;
    };
  };
};

type Project = {
  slug: string;
  name: string;
  summary: string;
  description: string;
  stack: string[];
  highlights: string[];
  links: Array<{ label: string; href: string }>;
};

type FriendsContent = {
  siteProfile: {
    name: string;
    href: string;
    description: string;
    avatar?: string;
  };
  friends: Array<{
    name: string;
    description: string;
    href: string;
    avatar?: string;
    tags?: string[];
  }>;
};

type ResourcesContent = {
  title: string;
  description: string;
  intro: string;
  groups: Array<{
    title: string;
    items: Array<{ name: string; description: string; href: string }>;
  }>;
};

type AboutContent = {
  title: string;
  description: string;
  paragraphs: string[];
};

type NowContent = {
  title: string;
  label: string;
  description: string;
  intro: string;
  cards: Array<{ title: string; description: string }>;
};

type ContentState = {
  site: SiteContent | null;
  projects: Project[];
  friends: FriendsContent | null;
  resources: ResourcesContent | null;
  about: AboutContent | null;
  now: NowContent | null;
};

type GitStatus = {
  isRepo: boolean;
  branch: string;
  remote: string;
  hasRemote: boolean;
  expectedRemote: string;
  sshRemote: string;
  remoteMatches: boolean;
  changes: string[];
  clean: boolean;
  needsSetup: boolean;
};

type ManagerContext = {
  siteName: string;
  repository: string;
  repositoryUrl: string;
  remoteUrl: string;
  sshRemoteUrl: string;
  pagesUrl: string;
  homepageUrl: string;
  actionsUrl: string;
  latestSuccessfulRunUrl: string;
  defaultBranch: string;
  pagesStatus: string;
  discussionsEnabled: boolean;
  giscus: {
    repo: string;
    repoId: string;
    category: string;
    categoryId: string;
  };
};

type ImageAsset = {
  name: string;
  path: string;
  size: number;
  modified: string;
};

type CheckState = Record<string, { ok?: boolean; output?: string; error?: string; running?: boolean }>;

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
  series: "",
  seriesOrder: undefined,
  cover: "",
  draft: true,
  featured: false,
  body: ""
};

const emptyContent: ContentState = {
  site: null,
  projects: [],
  friends: null,
  resources: null,
  about: null,
  now: null
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

const splitList = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
const joinList = (value: string[] = []) => value.join(", ");

const markdownToHtml = (markdown: string) => {
  const escape = (value: string) =>
    value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);

  return markdown
    .split(/\n{2,}/)
    .map((block) => {
      const text = block.trim();
      if (!text) return "";
      if (text.startsWith("```")) return `<pre>${escape(text.replace(/^```[^\n]*\n?/, "").replace(/```$/, ""))}</pre>`;
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

const moveItem = <T,>(items: T[], index: number, direction: -1 | 1) => {
  const next = [...items];
  const target = index + direction;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

function TextField({
  label,
  value,
  onChange,
  type = "text",
  rows
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  rows?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {rows ? (
        <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

function IconButton({
  label,
  onClick,
  children,
  disabled
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button className="icon-action" type="button" title={label} aria-label={label} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function ExternalLinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a className="link-button" href={href} target="_blank" rel="noreferrer">
      {children}
      <ExternalLink size={15} />
    </a>
  );
}

function ArrayEditor<T>({
  title,
  items,
  createItem,
  renderItem,
  onChange
}: {
  title: string;
  items: T[];
  createItem: () => T;
  renderItem: (item: T, index: number, update: (item: T) => void) => React.ReactNode;
  onChange: (items: T[]) => void;
}) {
  const updateItem = (index: number, item: T) => onChange(items.map((current, currentIndex) => (currentIndex === index ? item : current)));
  return (
    <section className="section-block">
      <div className="section-head">
        <h3>{title}</h3>
        <button type="button" onClick={() => onChange([...items, createItem()])}>
          <Plus size={16} />新增
        </button>
      </div>
      <div className="repeat-list">
        {items.map((item, index) => (
          <div className="repeat-item" key={index}>
            <div className="repeat-toolbar">
              <span>#{index + 1}</span>
              <div>
                <IconButton label="上移" onClick={() => onChange(moveItem(items, index, -1))} disabled={index === 0}><ArrowUp size={16} /></IconButton>
                <IconButton label="下移" onClick={() => onChange(moveItem(items, index, 1))} disabled={index === items.length - 1}><ArrowDown size={16} /></IconButton>
                <IconButton label="删除" onClick={() => onChange(items.filter((_, currentIndex) => currentIndex !== index))}><Trash2 size={16} /></IconButton>
              </div>
            </div>
            {renderItem(item, index, (next) => updateItem(index, next))}
          </div>
        ))}
        {items.length === 0 && <p className="empty-note">暂无条目。</p>}
      </div>
    </section>
  );
}

function App() {
  const [view, setView] = useState<View>("dashboard");
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<PostDetail>(emptyPost);
  const [content, setContent] = useState<ContentState>(emptyContent);
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [dark, setDark] = useState(() => localStorage.getItem("manager-theme") === "dark");
  const [preview, setPreview] = useState(true);
  const [managerContext, setManagerContext] = useState<ManagerContext | null>(null);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [checks, setChecks] = useState<CheckState>({});
  const [remoteUrl, setRemoteUrl] = useState("https://github.com/longwudf/shiyuboke.git");
  const [branch, setBranch] = useState("main");
  const [commitMessage, setCommitMessage] = useState("Update shiyuboke content");
  const [firstCommit, setFirstCommit] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("manager-theme", dark ? "dark" : "light");
  }, [dark]);

  const loadPosts = async () => {
    const data = await api<{ posts: PostSummary[] }>("/api/posts");
    setPosts(data.posts);
  };

  const loadContent = async () => {
    const keys = ["site", "projects", "friends", "resources", "about", "now"] as const;
    const loaded = await Promise.all(keys.map((key) => api<{ content: unknown }>(`/api/content/${key}`)));
    setContent({
      site: loaded[0].content as SiteContent,
      projects: loaded[1].content as Project[],
      friends: loaded[2].content as FriendsContent,
      resources: loaded[3].content as ResourcesContent,
      about: loaded[4].content as AboutContent,
      now: loaded[5].content as NowContent
    });
  };

  const loadImages = async () => {
    const data = await api<{ images: ImageAsset[] }>("/api/images");
    setImages(data.images);
  };

  const loadManagerContext = async () => {
    const context = await api<ManagerContext>("/api/manager/context");
    setManagerContext(context);
    setRemoteUrl((current) => current || context.remoteUrl);
    setBranch((current) => current || context.defaultBranch);
  };

  const loadGitStatus = async () => {
    const status = await api<GitStatus>("/api/git/status");
    setGitStatus(status);
    if (status.remote) setRemoteUrl(status.remote);
    if (status.branch) setBranch(status.branch);
    if (!status.isRepo) setFirstCommit(true);
  };

  const refreshAll = async () => {
    await Promise.all([loadPosts(), loadContent(), loadImages(), loadManagerContext(), loadGitStatus()]);
  };

  useEffect(() => {
    refreshAll().catch((error) => setMessage(error.message));
  }, []);

  const categories = useMemo(() => Array.from(new Set(posts.map((post) => post.category))).sort(), [posts]);
  const tags = useMemo(() => Array.from(new Set(posts.flatMap((post) => post.tags))).sort(), [posts]);
  const publishedCount = posts.filter((post) => !post.draft).length;
  const draftCount = posts.filter((post) => post.draft).length;
  const featuredCount = posts.filter((post) => post.featured).length;
  const latestUpdate = posts.reduce((latest, post) => {
    const value = post.updatedDate || post.date;
    return !latest || value > latest ? value : latest;
  }, "");

  const filteredPosts = posts.filter((post) => {
    const haystack = [post.title, post.description, post.category, post.tags.join(" "), post.series ?? ""].join(" ").toLowerCase();
    const matchesQuery = query.trim() ? haystack.includes(query.toLowerCase()) : true;
    const matchesStatus = statusFilter === "all" || (statusFilter === "draft" ? post.draft : !post.draft);
    const matchesCategory = categoryFilter === "all" || post.category === categoryFilter;
    const matchesTag = tagFilter === "all" || post.tags.includes(tagFilter);
    return matchesQuery && matchesStatus && matchesCategory && matchesTag;
  });

  const nav = [
    { view: "dashboard" as View, label: "Dashboard", icon: Home },
    { view: "posts" as View, label: "文章", icon: FileText },
    { view: "projects" as View, label: "项目", icon: FolderKanban },
    { view: "friends" as View, label: "友链", icon: Link2 },
    { view: "resources" as View, label: "资源", icon: BookOpen },
    { view: "pages" as View, label: "页面", icon: Settings },
    { view: "media" as View, label: "媒体", icon: Image },
    { view: "publish" as View, label: "发布", icon: Rocket }
  ];

  const setContentKey = <K extends keyof ContentState>(key: K, value: ContentState[K]) => {
    setContent((current) => ({ ...current, [key]: value }));
  };

  const saveContent = async <K extends keyof ContentState>(key: K) => {
    const value = content[key];
    if (!value) return;
    const result = await api<{ content: ContentState[K] }>(`/api/content/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value)
    });
    setContentKey(key, result.content);
    setMessage("内容已保存。");
  };

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
    setView("posts");
    setMessage("正在创建新文章，填写标题后会自动生成 slug。");
  };

  const updatePostField = <K extends keyof PostDetail>(key: K, value: PostDetail[K]) => {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === "title" && !current.id) next.slug = slugify(String(value));
      return next;
    });
  };

  const savePost = async () => {
    const payload = { ...draft, seriesOrder: draft.seriesOrder || undefined };
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
    setMessage("文章已保存。");
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
    updatePostField("cover", result.path);
    await loadImages();
    setMessage("图片已上传。");
  };

  const runCheck = async (name: string) => {
    setChecks((current) => ({ ...current, [name]: { running: true } }));
    try {
      const result = await api<{ ok: boolean; output?: string; error?: string }>(`/api/checks/${name}`, { method: "POST" });
      setChecks((current) => ({ ...current, [name]: { ok: result.ok, output: result.output } }));
    } catch (error) {
      setChecks((current) => ({ ...current, [name]: { ok: false, error: (error as Error).message } }));
    }
  };

  const initGit = async () => {
    setBusy(true);
    try {
      const result = await api<{ message: string; status: GitStatus }>("/api/git/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remoteUrl, branch })
      });
      setGitStatus(result.status);
      setFirstCommit(true);
      setMessage(result.message);
    } finally {
      setBusy(false);
    }
  };

  const commitGit = async () => {
    setBusy(true);
    try {
      const result = await api<{ message: string; output: string }>("/api/git/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstCommit, message: commitMessage })
      });
      setMessage(`${result.message}\n${result.output}`);
      setFirstCommit(false);
      await loadGitStatus();
    } finally {
      setBusy(false);
    }
  };

  const pushGit = async () => {
    setBusy(true);
    try {
      const result = await api<{ message: string; output: string }>("/api/git/push", { method: "POST" });
      setMessage(`${result.message}\n${result.output}`);
      await loadGitStatus();
    } finally {
      setBusy(false);
    }
  };

  const renderDashboard = () => {
    const pagesUrl = managerContext?.pagesUrl ?? content.site?.deployment.pagesUrl ?? "";
    const homepageUrl = managerContext?.homepageUrl ?? content.site?.deployment.homepageUrl ?? "";
    const repositoryUrl = managerContext?.repositoryUrl ?? content.site?.deployment.repositoryUrl ?? "";
    const actionsUrl = managerContext?.actionsUrl ?? content.site?.deployment.actionsUrl ?? "";
    const latestRunUrl = managerContext?.latestSuccessfulRunUrl ?? content.site?.deployment.latestSuccessfulRunUrl ?? "";
    const repository = managerContext?.repository ?? content.site?.deployment.repository ?? "longwudf/shiyuboke";
    const giscus = managerContext?.giscus ?? content.site?.comments.giscus;
    const discussionsEnabled = managerContext?.discussionsEnabled ?? content.site?.deployment.discussionsEnabled ?? false;

    return (
      <div className="page-grid">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">诗余博客本地管理器</p>
            <h2>{content.site?.brand.name ?? "诗余博客"}</h2>
            <p>{content.site?.brand.description ?? "正在加载站点资料。"}</p>
            <div className="link-row">
              {pagesUrl && <ExternalLinkButton href={pagesUrl}>线上站点</ExternalLinkButton>}
              {homepageUrl && <ExternalLinkButton href={homepageUrl}>仓库主页</ExternalLinkButton>}
              {repositoryUrl && <ExternalLinkButton href={repositoryUrl}>GitHub 仓库</ExternalLinkButton>}
              {latestRunUrl && <ExternalLinkButton href={latestRunUrl}>最近成功部署</ExternalLinkButton>}
            </div>
          </div>
          <button type="button" onClick={refreshAll}>
            <RefreshCcw size={16} />刷新
          </button>
        </section>
        <div className="metric-grid">
          <div className="metric"><span>文章</span><strong>{posts.length}</strong></div>
          <div className="metric"><span>草稿</span><strong>{draftCount}</strong></div>
          <div className="metric"><span>已发布</span><strong>{publishedCount}</strong></div>
          <div className="metric"><span>精选</span><strong>{featuredCount}</strong></div>
          <div className="metric"><span>分类</span><strong>{categories.length}</strong></div>
          <div className="metric"><span>标签</span><strong>{tags.length}</strong></div>
        </div>
        <div className="two-col">
          <section className="panel">
            <h3>本地状态</h3>
            <dl className="status-list">
              <div><dt>最近更新</dt><dd>{latestUpdate || "暂无"}</dd></div>
              <div><dt>Git 仓库</dt><dd>{gitStatus?.isRepo ? `已初始化 · ${gitStatus.branch || "未知分支"}` : "未初始化"}</dd></div>
              <div><dt>Remote</dt><dd>{gitStatus?.remote || "未设置"}</dd></div>
              <div><dt>目标仓库</dt><dd>{gitStatus?.remoteMatches ? "已指向诗余博客" : `应为 ${gitStatus?.expectedRemote ?? "诗余博客仓库"}`}</dd></div>
              <div><dt>工作区</dt><dd>{gitStatus?.clean ? "干净" : `${gitStatus?.changes.length ?? 0} 个变更`}</dd></div>
            </dl>
          </section>
          <section className="panel">
            <h3>线上目标</h3>
            <dl className="status-list">
              <div><dt>仓库</dt><dd>{repository}</dd></div>
              <div><dt>仓库主页</dt><dd>{homepageUrl || "未配置"}</dd></div>
              <div><dt>Pages</dt><dd>{pagesUrl ? "已部署并可访问" : "未配置"}</dd></div>
              <div><dt>Actions</dt><dd>{actionsUrl ? "已连接发布流水线" : "未配置"}</dd></div>
              <div><dt>Discussions</dt><dd>{discussionsEnabled ? "已开启" : "未开启"}</dd></div>
              <div><dt>Giscus</dt><dd>{giscus ? `${giscus.category} · ${giscus.repoId}` : "未配置"}</dd></div>
            </dl>
          </section>
        </div>
        <section className="panel">
          <h3>快捷操作</h3>
          <div className="button-grid">
            <button type="button" onClick={createPost}><Plus size={16} />新文章</button>
            <button type="button" onClick={() => setView("pages")}><Settings size={16} />编辑页面</button>
            <button type="button" onClick={() => setView("publish")}><Rocket size={16} />发布流程</button>
          </div>
        </section>
      </div>
    );
  };

  const renderPosts = () => (
    <div className="content-layout">
      <aside className="list-panel">
        <div className="list-head">
          <h2>文章</h2>
          <button type="button" onClick={createPost}><Plus size={16} />新增</button>
        </div>
        <div className="filters">
          <label className="search-box">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、标签、系列" />
          </label>
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
              <small>{post.draft ? "草稿" : "已发布"} · {post.category}{post.series ? ` · ${post.series}` : ""}</small>
            </button>
          ))}
          {filteredPosts.length === 0 && <p className="empty-note">没有匹配的文章。</p>}
        </div>
      </aside>

      <section className="editor-panel">
        <header className="toolbar">
          <button className="primary" type="button" onClick={savePost}><Save size={16} />保存</button>
          <button type="button" onClick={() => publish(true)} disabled={!selectedId || !draft.draft}>发布</button>
          <button type="button" onClick={() => publish(false)} disabled={!selectedId || draft.draft}>取消发布</button>
          <button className="danger" type="button" onClick={removePost} disabled={!selectedId}><Trash2 size={16} />删除</button>
        </header>
        <div className="editor-grid">
          <div className="form-panel">
            <div className="field-grid">
              <TextField label="标题" value={draft.title} onChange={(value) => updatePostField("title", value)} />
              <TextField label="Slug" value={draft.slug} onChange={(value) => updatePostField("slug", slugify(value))} />
              <TextField label="日期" type="date" value={draft.date} onChange={(value) => updatePostField("date", value)} />
              <TextField label="更新日期" type="date" value={draft.updatedDate} onChange={(value) => updatePostField("updatedDate", value)} />
              <TextField label="分类" value={draft.category} onChange={(value) => updatePostField("category", value)} />
              <TextField label="标签" value={joinList(draft.tags)} onChange={(value) => updatePostField("tags", splitList(value))} />
              <TextField label="系列" value={draft.series ?? ""} onChange={(value) => updatePostField("series", value)} />
              <TextField label="系列顺序" type="number" value={draft.seriesOrder ? String(draft.seriesOrder) : ""} onChange={(value) => updatePostField("seriesOrder", value ? Number(value) : undefined)} />
            </div>
            <TextField label="描述" rows={3} value={draft.description} onChange={(value) => updatePostField("description", value)} />
            <div className="field-grid">
              <TextField label="封面路径" value={draft.cover} onChange={(value) => updatePostField("cover", value)} />
              <label className="field">
                <span>上传封面</span>
                <input type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.svg" onChange={(event) => uploadCover(event.target.files?.[0] ?? null)} />
              </label>
            </div>
            <div className="switches">
              <label><input type="checkbox" checked={draft.draft} onChange={(event) => updatePostField("draft", event.target.checked)} /> 草稿</label>
              <label><input type="checkbox" checked={draft.featured} onChange={(event) => updatePostField("featured", event.target.checked)} /> 精选</label>
              <label><input type="checkbox" checked={preview} onChange={(event) => setPreview(event.target.checked)} /> 预览</label>
            </div>
            <label className="field">
              <span>Markdown / MDX 正文</span>
              <textarea className="body-editor" value={draft.body} onChange={(event) => updatePostField("body", event.target.value)} />
            </label>
          </div>
          {preview && (
            <aside className="preview-panel">
              <p className="eyebrow">Preview</p>
              {draft.cover && <img src={draft.cover} alt="" />}
              <h1>{draft.title || "未命名文章"}</h1>
              <p className="preview-desc">{draft.description}</p>
              <article dangerouslySetInnerHTML={{ __html: markdownToHtml(draft.body) }} />
            </aside>
          )}
        </div>
      </section>
    </div>
  );

  const renderProjects = () => (
    <section className="panel wide">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Projects</p>
          <h2>项目管理</h2>
        </div>
        <button className="primary" type="button" onClick={() => saveContent("projects")}><Save size={16} />保存项目</button>
      </div>
      <ArrayEditor
        title="项目"
        items={content.projects}
        createItem={() => ({ slug: "new-project", name: "新项目", summary: "", description: "", stack: [], highlights: [], links: [] })}
        onChange={(items) => setContentKey("projects", items)}
        renderItem={(project, _index, update) => (
          <>
            <div className="field-grid">
              <TextField label="Slug" value={project.slug} onChange={(value) => update({ ...project, slug: slugify(value) })} />
              <TextField label="名称" value={project.name} onChange={(value) => update({ ...project, name: value })} />
              <TextField label="摘要" value={project.summary} onChange={(value) => update({ ...project, summary: value })} />
              <TextField label="技术栈" value={joinList(project.stack)} onChange={(value) => update({ ...project, stack: splitList(value) })} />
            </div>
            <TextField label="描述" rows={3} value={project.description} onChange={(value) => update({ ...project, description: value })} />
            <TextField label="关键点" rows={2} value={project.highlights.join("\n")} onChange={(value) => update({ ...project, highlights: value.split("\n").map((item) => item.trim()).filter(Boolean) })} />
            <ArrayEditor
              title="相关链接"
              items={project.links}
              createItem={() => ({ label: "链接", href: "/" })}
              onChange={(links) => update({ ...project, links })}
              renderItem={(link, _linkIndex, updateLink) => (
                <div className="field-grid">
                  <TextField label="标签" value={link.label} onChange={(value) => updateLink({ ...link, label: value })} />
                  <TextField label="链接" value={link.href} onChange={(value) => updateLink({ ...link, href: value })} />
                </div>
              )}
            />
          </>
        )}
      />
    </section>
  );

  const renderFriends = () => {
    const friends = content.friends;
    if (!friends) return <p className="empty-note">正在加载友链。</p>;
    return (
      <section className="panel wide">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Friends</p>
            <h2>友链管理</h2>
          </div>
          <button className="primary" type="button" onClick={() => saveContent("friends")}><Save size={16} />保存友链</button>
        </div>
        <section className="section-block">
          <h3>本站信息</h3>
          <div className="field-grid">
            <TextField label="名称" value={friends.siteProfile.name} onChange={(value) => setContentKey("friends", { ...friends, siteProfile: { ...friends.siteProfile, name: value } })} />
            <TextField label="地址" value={friends.siteProfile.href} onChange={(value) => setContentKey("friends", { ...friends, siteProfile: { ...friends.siteProfile, href: value } })} />
            <TextField label="头像" value={friends.siteProfile.avatar ?? ""} onChange={(value) => setContentKey("friends", { ...friends, siteProfile: { ...friends.siteProfile, avatar: value } })} />
          </div>
          <TextField label="描述" rows={2} value={friends.siteProfile.description} onChange={(value) => setContentKey("friends", { ...friends, siteProfile: { ...friends.siteProfile, description: value } })} />
        </section>
        <ArrayEditor
          title="朋友站点"
          items={friends.friends}
          createItem={() => ({ name: "新朋友", description: "", href: "https://", avatar: "", tags: [] })}
          onChange={(items) => setContentKey("friends", { ...friends, friends: items })}
          renderItem={(friend, _index, update) => (
            <>
              <div className="field-grid">
                <TextField label="名称" value={friend.name} onChange={(value) => update({ ...friend, name: value })} />
                <TextField label="地址" value={friend.href} onChange={(value) => update({ ...friend, href: value })} />
                <TextField label="头像" value={friend.avatar ?? ""} onChange={(value) => update({ ...friend, avatar: value })} />
                <TextField label="标签" value={joinList(friend.tags)} onChange={(value) => update({ ...friend, tags: splitList(value) })} />
              </div>
              <TextField label="描述" rows={2} value={friend.description} onChange={(value) => update({ ...friend, description: value })} />
            </>
          )}
        />
      </section>
    );
  };

  const renderResources = () => {
    const resources = content.resources;
    if (!resources) return <p className="empty-note">正在加载资源。</p>;
    return (
      <section className="panel wide">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Resources</p>
            <h2>资源管理</h2>
          </div>
          <button className="primary" type="button" onClick={() => saveContent("resources")}><Save size={16} />保存资源</button>
        </div>
        <div className="field-grid">
          <TextField label="标题" value={resources.title} onChange={(value) => setContentKey("resources", { ...resources, title: value })} />
          <TextField label="SEO 描述" value={resources.description} onChange={(value) => setContentKey("resources", { ...resources, description: value })} />
        </div>
        <TextField label="页面导语" rows={2} value={resources.intro} onChange={(value) => setContentKey("resources", { ...resources, intro: value })} />
        <ArrayEditor
          title="资源分组"
          items={resources.groups}
          createItem={() => ({ title: "新分组", items: [] })}
          onChange={(groups) => setContentKey("resources", { ...resources, groups })}
          renderItem={(group, _index, update) => (
            <>
              <TextField label="分组标题" value={group.title} onChange={(value) => update({ ...group, title: value })} />
              <ArrayEditor
                title="资源条目"
                items={group.items}
                createItem={() => ({ name: "资源", description: "", href: "https://" })}
                onChange={(items) => update({ ...group, items })}
                renderItem={(item, _itemIndex, updateItem) => (
                  <div className="field-grid">
                    <TextField label="名称" value={item.name} onChange={(value) => updateItem({ ...item, name: value })} />
                    <TextField label="链接" value={item.href} onChange={(value) => updateItem({ ...item, href: value })} />
                    <TextField label="描述" value={item.description} onChange={(value) => updateItem({ ...item, description: value })} />
                  </div>
                )}
              />
            </>
          )}
        />
      </section>
    );
  };

  const renderPages = () => {
    const site = content.site;
    const about = content.about;
    const now = content.now;
    if (!site || !about || !now) return <p className="empty-note">正在加载页面内容。</p>;

    return (
      <div className="page-grid">
        <section className="panel wide">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Site</p>
              <h2>站点资料与首页</h2>
            </div>
            <button className="primary" type="button" onClick={() => saveContent("site")}><Save size={16} />保存站点</button>
          </div>
          <div className="field-grid">
            <TextField label="站点名" value={site.brand.name} onChange={(value) => setContentKey("site", { ...site, brand: { ...site.brand, name: value } })} />
            <TextField label="短标识" value={site.brand.shortName} onChange={(value) => setContentKey("site", { ...site, brand: { ...site.brand, shortName: value } })} />
            <TextField label="作者" value={site.brand.author} onChange={(value) => setContentKey("site", { ...site, brand: { ...site.brand, author: value } })} />
            <TextField label="邮箱" value={site.brand.email} onChange={(value) => setContentKey("site", { ...site, brand: { ...site.brand, email: value } })} />
            <TextField label="站点标题" value={site.brand.title} onChange={(value) => setContentKey("site", { ...site, brand: { ...site.brand, title: value } })} />
            <TextField label="Tagline" value={site.brand.tagline} onChange={(value) => setContentKey("site", { ...site, brand: { ...site.brand, tagline: value } })} />
          </div>
          <TextField label="站点描述" rows={2} value={site.brand.description} onChange={(value) => setContentKey("site", { ...site, brand: { ...site.brand, description: value } })} />
          <div className="field-grid">
            <TextField label="站点主页" value={site.brand.profileUrl} onChange={(value) => setContentKey("site", { ...site, brand: { ...site.brand, profileUrl: value } })} />
            <TextField label="头像地址" value={site.brand.avatar} onChange={(value) => setContentKey("site", { ...site, brand: { ...site.brand, avatar: value } })} />
            <TextField label="首页 Eyebrow" value={site.home.eyebrow} onChange={(value) => setContentKey("site", { ...site, home: { ...site.home, eyebrow: value } })} />
          </div>
          <TextField label="首页标题" rows={2} value={site.home.headline} onChange={(value) => setContentKey("site", { ...site, home: { ...site.home, headline: value } })} />
          <TextField label="首页导语" rows={2} value={site.home.intro} onChange={(value) => setContentKey("site", { ...site, home: { ...site.home, intro: value } })} />
          <section className="section-block">
            <h3>发布与评论</h3>
            <div className="field-grid">
              <TextField label="GitHub 仓库" value={site.deployment.repository} onChange={(value) => setContentKey("site", { ...site, deployment: { ...site.deployment, repository: value } })} />
              <TextField label="仓库地址" value={site.deployment.repositoryUrl} onChange={(value) => setContentKey("site", { ...site, deployment: { ...site.deployment, repositoryUrl: value } })} />
              <TextField label="HTTPS Remote" value={site.deployment.remoteUrl} onChange={(value) => setContentKey("site", { ...site, deployment: { ...site.deployment, remoteUrl: value } })} />
              <TextField label="SSH Remote" value={site.deployment.sshRemoteUrl} onChange={(value) => setContentKey("site", { ...site, deployment: { ...site.deployment, sshRemoteUrl: value } })} />
              <TextField label="Pages 地址" value={site.deployment.pagesUrl} onChange={(value) => setContentKey("site", { ...site, deployment: { ...site.deployment, pagesUrl: value } })} />
              <TextField label="仓库主页" value={site.deployment.homepageUrl} onChange={(value) => setContentKey("site", { ...site, deployment: { ...site.deployment, homepageUrl: value } })} />
              <TextField label="Actions 地址" value={site.deployment.actionsUrl} onChange={(value) => setContentKey("site", { ...site, deployment: { ...site.deployment, actionsUrl: value } })} />
              <TextField label="最近成功 Run" value={site.deployment.latestSuccessfulRunUrl} onChange={(value) => setContentKey("site", { ...site, deployment: { ...site.deployment, latestSuccessfulRunUrl: value } })} />
              <TextField label="默认分支" value={site.deployment.defaultBranch} onChange={(value) => setContentKey("site", { ...site, deployment: { ...site.deployment, defaultBranch: value } })} />
            </div>
            <label className="field inline-field">
              <span>Discussions 已开启</span>
              <input type="checkbox" checked={site.deployment.discussionsEnabled} onChange={(event) => setContentKey("site", { ...site, deployment: { ...site.deployment, discussionsEnabled: event.target.checked } })} />
            </label>
            <label className="field inline-field">
              <span>启用 Giscus</span>
              <input type="checkbox" checked={site.comments.enabled} onChange={(event) => setContentKey("site", { ...site, comments: { ...site.comments, enabled: event.target.checked } })} />
            </label>
            <div className="field-grid">
              <TextField label="Giscus repo" value={site.comments.giscus.repo} onChange={(value) => setContentKey("site", { ...site, comments: { ...site.comments, giscus: { ...site.comments.giscus, repo: value } } })} />
              <TextField label="Giscus repoId" value={site.comments.giscus.repoId} onChange={(value) => setContentKey("site", { ...site, comments: { ...site.comments, giscus: { ...site.comments.giscus, repoId: value } } })} />
              <TextField label="Giscus category" value={site.comments.giscus.category} onChange={(value) => setContentKey("site", { ...site, comments: { ...site.comments, giscus: { ...site.comments.giscus, category: value } } })} />
              <TextField label="Giscus categoryId" value={site.comments.giscus.categoryId} onChange={(value) => setContentKey("site", { ...site, comments: { ...site.comments, giscus: { ...site.comments.giscus, categoryId: value } } })} />
            </div>
          </section>
          <ArrayEditor
            title="主导航"
            items={site.navigation}
            createItem={() => ({ label: "导航", href: "/" })}
            onChange={(navigation) => setContentKey("site", { ...site, navigation })}
            renderItem={(link, _index, update) => (
              <div className="field-grid">
                <TextField label="文案" value={link.label} onChange={(value) => update({ ...link, label: value })} />
                <TextField label="链接" value={link.href} onChange={(value) => update({ ...link, href: value })} />
              </div>
            )}
          />
          <ArrayEditor
            title="页脚链接"
            items={site.footerLinks}
            createItem={() => ({ label: "链接", href: "/" })}
            onChange={(footerLinks) => setContentKey("site", { ...site, footerLinks })}
            renderItem={(link, _index, update) => (
              <div className="field-grid">
                <TextField label="文案" value={link.label} onChange={(value) => update({ ...link, label: value })} />
                <TextField label="链接" value={link.href} onChange={(value) => update({ ...link, href: value })} />
              </div>
            )}
          />
          <ArrayEditor
            title="首页按钮"
            items={site.home.actions}
            createItem={() => ({ label: "按钮", href: "/", variant: "secondary" })}
            onChange={(actions) => setContentKey("site", { ...site, home: { ...site.home, actions } })}
            renderItem={(action, _index, update) => (
              <div className="field-grid">
                <TextField label="文案" value={action.label} onChange={(value) => update({ ...action, label: value })} />
                <TextField label="链接" value={action.href} onChange={(value) => update({ ...action, href: value })} />
                <label className="field">
                  <span>样式</span>
                  <select value={action.variant ?? "secondary"} onChange={(event) => update({ ...action, variant: event.target.value })}>
                    <option value="primary">主要</option>
                    <option value="secondary">次要</option>
                  </select>
                </label>
              </div>
            )}
          />
          <ArrayEditor
            title="社交链接"
            items={site.home.socialLinks}
            createItem={() => ({ label: "链接", href: "https://", external: true })}
            onChange={(socialLinks) => setContentKey("site", { ...site, home: { ...site.home, socialLinks } })}
            renderItem={(link, _index, update) => (
              <div className="field-grid">
                <TextField label="文案" value={link.label} onChange={(value) => update({ ...link, label: value })} />
                <TextField label="链接" value={link.href} onChange={(value) => update({ ...link, href: value })} />
                <label className="field inline-field">
                  <span>新窗口</span>
                  <input type="checkbox" checked={Boolean(link.external)} onChange={(event) => update({ ...link, external: event.target.checked })} />
                </label>
              </div>
            )}
          />
          <section className="section-block">
            <h3>首页 Now 摘要</h3>
            <div className="field-grid">
              <TextField label="标签" value={site.home.now.label} onChange={(value) => setContentKey("site", { ...site, home: { ...site.home, now: { ...site.home.now, label: value } } })} />
              <TextField label="标题" value={site.home.now.title} onChange={(value) => setContentKey("site", { ...site, home: { ...site.home, now: { ...site.home.now, title: value } } })} />
            </div>
            <TextField label="描述" rows={2} value={site.home.now.description} onChange={(value) => setContentKey("site", { ...site, home: { ...site.home, now: { ...site.home.now, description: value } } })} />
          </section>
          <section className="section-block">
            <h3>首页文章区块</h3>
            <div className="field-grid">
              <TextField label="精选标签" value={site.home.featured.label} onChange={(value) => setContentKey("site", { ...site, home: { ...site.home, featured: { ...site.home.featured, label: value } } })} />
              <TextField label="精选标题" value={site.home.featured.title} onChange={(value) => setContentKey("site", { ...site, home: { ...site.home, featured: { ...site.home.featured, title: value } } })} />
              <TextField label="精选链接文案" value={site.home.featured.linkLabel} onChange={(value) => setContentKey("site", { ...site, home: { ...site.home, featured: { ...site.home.featured, linkLabel: value } } })} />
              <TextField label="最新标签" value={site.home.latest.label} onChange={(value) => setContentKey("site", { ...site, home: { ...site.home, latest: { ...site.home.latest, label: value } } })} />
              <TextField label="最新标题" value={site.home.latest.title} onChange={(value) => setContentKey("site", { ...site, home: { ...site.home, latest: { ...site.home.latest, title: value } } })} />
              <TextField label="最新链接文案" value={site.home.latest.linkLabel} onChange={(value) => setContentKey("site", { ...site, home: { ...site.home, latest: { ...site.home.latest, linkLabel: value } } })} />
            </div>
          </section>
          <section className="section-block">
            <h3>首页项目入口</h3>
            <div className="field-grid">
              <TextField label="标签" value={site.home.projects.label} onChange={(value) => setContentKey("site", { ...site, home: { ...site.home, projects: { ...site.home.projects, label: value } } })} />
              <TextField label="标题" value={site.home.projects.title} onChange={(value) => setContentKey("site", { ...site, home: { ...site.home, projects: { ...site.home.projects, title: value } } })} />
              <TextField label="按钮文案" value={site.home.projects.actionLabel} onChange={(value) => setContentKey("site", { ...site, home: { ...site.home, projects: { ...site.home.projects, actionLabel: value } } })} />
            </div>
            <TextField label="描述" rows={2} value={site.home.projects.description} onChange={(value) => setContentKey("site", { ...site, home: { ...site.home, projects: { ...site.home.projects, description: value } } })} />
            <ArrayEditor
              title="项目入口卡片"
              items={site.home.projects.cards}
              createItem={() => ({ label: "Card", title: "新卡片", description: "" })}
              onChange={(cards) => setContentKey("site", { ...site, home: { ...site.home, projects: { ...site.home.projects, cards } } })}
              renderItem={(card, _index, update) => (
                <div className="field-grid">
                  <TextField label="标签" value={card.label} onChange={(value) => update({ ...card, label: value })} />
                  <TextField label="标题" value={card.title} onChange={(value) => update({ ...card, title: value })} />
                  <TextField label="描述" value={card.description} onChange={(value) => update({ ...card, description: value })} />
                </div>
              )}
            />
          </section>
        </section>
        <section className="panel wide">
          <div className="panel-head">
            <div>
              <p className="eyebrow">About</p>
              <h2>关于页</h2>
            </div>
            <button className="primary" type="button" onClick={() => saveContent("about")}><Save size={16} />保存关于</button>
          </div>
          <div className="field-grid">
            <TextField label="标题" value={about.title} onChange={(value) => setContentKey("about", { ...about, title: value })} />
            <TextField label="SEO 描述" value={about.description} onChange={(value) => setContentKey("about", { ...about, description: value })} />
          </div>
          <TextField label="段落，每行一段" rows={6} value={about.paragraphs.join("\n")} onChange={(value) => setContentKey("about", { ...about, paragraphs: value.split("\n").map((item) => item.trim()).filter(Boolean) })} />
        </section>
        <section className="panel wide">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Now</p>
              <h2>Now 页</h2>
            </div>
            <button className="primary" type="button" onClick={() => saveContent("now")}><Save size={16} />保存 Now</button>
          </div>
          <div className="field-grid">
            <TextField label="标签" value={now.label} onChange={(value) => setContentKey("now", { ...now, label: value })} />
            <TextField label="标题" value={now.title} onChange={(value) => setContentKey("now", { ...now, title: value })} />
            <TextField label="SEO 描述" value={now.description} onChange={(value) => setContentKey("now", { ...now, description: value })} />
          </div>
          <TextField label="导语" rows={2} value={now.intro} onChange={(value) => setContentKey("now", { ...now, intro: value })} />
          <ArrayEditor
            title="关注卡片"
            items={now.cards}
            createItem={() => ({ title: "新关注", description: "" })}
            onChange={(cards) => setContentKey("now", { ...now, cards })}
            renderItem={(card, _index, update) => (
              <div className="field-grid">
                <TextField label="标题" value={card.title} onChange={(value) => update({ ...card, title: value })} />
                <TextField label="描述" value={card.description} onChange={(value) => update({ ...card, description: value })} />
              </div>
            )}
          />
        </section>
      </div>
    );
  };

  const renderMedia = () => (
    <section className="panel wide">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Media</p>
          <h2>媒体库</h2>
        </div>
        <label className="upload-button">
          <Upload size={16} />上传图片
          <input type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.svg" onChange={(event) => uploadCover(event.target.files?.[0] ?? null)} />
        </label>
      </div>
      <div className="media-grid">
        {images.map((asset) => (
          <article className="media-item" key={asset.path}>
            <div className="media-preview">
              <img src={asset.path} alt={asset.name} />
            </div>
            <strong>{asset.name}</strong>
            <code>{asset.path}</code>
            <span>{Math.round(asset.size / 1024)} KB</span>
          </article>
        ))}
      </div>
    </section>
  );

  const renderPublish = () => {
    const checkLabels = [
      { id: "posts", label: "文章校验" },
      { id: "images", label: "图片校验" },
      { id: "astro", label: "Astro 检查" },
      { id: "build", label: "构建部署产物" }
    ];
    const pagesUrl = managerContext?.pagesUrl ?? content.site?.deployment.pagesUrl ?? "";
    const homepageUrl = managerContext?.homepageUrl ?? content.site?.deployment.homepageUrl ?? "";
    const repositoryUrl = managerContext?.repositoryUrl ?? content.site?.deployment.repositoryUrl ?? "";
    const actionsUrl = managerContext?.actionsUrl ?? content.site?.deployment.actionsUrl ?? "";
    const latestRunUrl = managerContext?.latestSuccessfulRunUrl ?? content.site?.deployment.latestSuccessfulRunUrl ?? "";
    const repository = managerContext?.repository ?? content.site?.deployment.repository ?? "longwudf/shiyuboke";
    const defaultRemote = managerContext?.remoteUrl ?? content.site?.deployment.remoteUrl ?? "https://github.com/longwudf/shiyuboke.git";
    const sshRemote = managerContext?.sshRemoteUrl ?? content.site?.deployment.sshRemoteUrl ?? "git@github.com:longwudf/shiyuboke.git";
    const giscus = managerContext?.giscus ?? content.site?.comments.giscus;
    return (
      <div className="page-grid">
        <section className="panel wide">
          <div className="panel-head">
            <div>
              <p className="eyebrow">GitHub Pages</p>
              <h2>诗余博客发布目标</h2>
            </div>
            <div className="link-row compact">
              {pagesUrl && <ExternalLinkButton href={pagesUrl}>线上站点</ExternalLinkButton>}
              {homepageUrl && <ExternalLinkButton href={homepageUrl}>仓库主页</ExternalLinkButton>}
              {repositoryUrl && <ExternalLinkButton href={repositoryUrl}>仓库</ExternalLinkButton>}
              {actionsUrl && <ExternalLinkButton href={actionsUrl}>Actions</ExternalLinkButton>}
            </div>
          </div>
          <div className="target-grid">
            <article>
              <span>Pages</span>
              <strong>已部署</strong>
              <small>{pagesUrl ? `${pagesUrl} · 仓库主页 ${homepageUrl || "未记录"}` : "未配置 Pages 地址"}</small>
            </article>
            <article>
              <span>GitHub Actions</span>
              <strong>最近部署成功</strong>
              <small>{latestRunUrl || "未记录 run 地址"}</small>
            </article>
            <article>
              <span>Discussions / Giscus</span>
              <strong>{giscus ? "评论已接入" : "未配置"}</strong>
              <small>{giscus ? `${giscus.repo} · ${giscus.category}` : "需要配置 Giscus"}</small>
            </article>
          </div>
        </section>
        <section className="panel wide">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Git</p>
              <h2>本地仓库设置</h2>
            </div>
            <button type="button" onClick={loadGitStatus}><RefreshCcw size={16} />刷新状态</button>
          </div>
          <p className="hint">
            本管理器专门推送到 {repository}。HTTPS remote 默认为 {defaultRemote}，也接受 SSH remote：{sshRemote}。
          </p>
          <div className="status-strip">
            <span>{gitStatus?.isRepo ? "已初始化" : "未初始化"}</span>
            <span>{gitStatus?.branch || "无分支"}</span>
            <span>{gitStatus?.remote || "未设置 remote"}</span>
            <span>{gitStatus?.remoteMatches ? "目标仓库正确" : "需要指向诗余博客"}</span>
            <span>{gitStatus?.clean ? "工作区干净" : `${gitStatus?.changes.length ?? 0} 个变更`}</span>
          </div>
          {(!gitStatus?.isRepo || gitStatus.needsSetup) && (
            <div className="setup-grid">
              <TextField label="Remote URL" value={remoteUrl} onChange={setRemoteUrl} />
              <TextField label="默认分支" value={branch} onChange={setBranch} />
              <button className="primary" type="button" onClick={initGit} disabled={busy || !remoteUrl.trim()}>
                <GitBranch size={16} />初始化 / 设置 Remote
              </button>
            </div>
          )}
        </section>
        <section className="panel wide">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Checks</p>
              <h2>发布前检查</h2>
            </div>
            <button type="button" onClick={() => checkLabels.forEach((check) => runCheck(check.id))}><ListChecks size={16} />全部运行</button>
          </div>
          <div className="check-grid">
            {checkLabels.map((check) => {
              const state = checks[check.id] ?? {};
              return (
                <article className={`check-card ${state.ok === false ? "fail" : state.ok ? "pass" : ""}`} key={check.id}>
                  <div>
                    <CheckCircle2 size={18} />
                    <strong>{check.label}</strong>
                  </div>
                  <button type="button" onClick={() => runCheck(check.id)} disabled={state.running}>{state.running ? "运行中" : "运行"}</button>
                  {(state.output || state.error) && <pre>{state.output || state.error}</pre>}
                </article>
              );
            })}
          </div>
        </section>
        <section className="panel wide">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Publish</p>
              <h2>提交并推送</h2>
            </div>
          </div>
          <div className="field-grid">
            <TextField label="提交信息" value={commitMessage} onChange={setCommitMessage} />
            <label className="field inline-field">
              <span>首次提交</span>
              <input type="checkbox" checked={firstCommit} onChange={(event) => setFirstCommit(event.target.checked)} />
            </label>
          </div>
          <div className="button-row">
            <button className="primary" type="button" onClick={commitGit} disabled={busy || !gitStatus?.isRepo}><Save size={16} />创建提交</button>
            <button type="button" onClick={pushGit} disabled={busy || !gitStatus?.hasRemote}><Rocket size={16} />推送到 GitHub</button>
          </div>
        </section>
      </div>
    );
  };

  const renderView = () => {
    if (view === "dashboard") return renderDashboard();
    if (view === "posts") return renderPosts();
    if (view === "projects") return renderProjects();
    if (view === "friends") return renderFriends();
    if (view === "resources") return renderResources();
    if (view === "pages") return renderPages();
    if (view === "media") return renderMedia();
    return renderPublish();
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div>
            <p className="eyebrow">GitHub Pages</p>
            <h1>{content.site?.brand.name ?? "博客 CMS"}</h1>
          </div>
          <button className="icon-button" type="button" onClick={() => setDark((value) => !value)} title="切换主题">
            {dark ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
        <nav className="nav-list">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.view} className={view === item.view ? "active" : ""} type="button" onClick={() => setView(item.view)}>
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>
      <section className="workspace">
        {message && (
          <pre className="message">
            {message}
          </pre>
        )}
        {renderView()}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
