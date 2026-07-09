const state = {
  meta: {
    apps: [],
    accounts: [],
    formats: [],
    stats: {},
    dates: {},
  },
  page: 1,
  pageSize: 50,
  pages: 1,
  sort: "views",
  direction: "desc",
  selected: new Set(),
  currentRows: [],
  searchTimer: null,
  sidebarCollapsed: false,
  lastOverlaySidebarViewport: false,
  activeFormatTrigger: null,
};

const BRAND_NAME = "HookDeck";
const STATIC_STORAGE_KEY = "hookDeckStaticState:v1";
const SIDEBAR_STORAGE_KEY = "hookDeckSidebarCollapsed";

const staticData = {
  loaded: false,
  loading: null,
  meta: null,
  rows: [],
  columns: {},
  formats: [],
  assignments: new Map(),
  nextFormatId: 1,
  sortCache: new Map(),
};

const els = {};

function $(selector) {
  return document.querySelector(selector);
}

function $all(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function rememberElements() {
  Object.assign(els, {
    appShell: $("#app-shell"),
    sidebar: $("#sidebar"),
    sidebarBackdrop: $("#sidebar-backdrop"),
    sidebarToggle: $("#sidebar-toggle"),
    sidebarClose: $("#sidebar-close"),
    pageTitle: $("#page-title"),
    viewLabel: $("#view-label"),
    toast: $("#toast"),
    statVideos: $("#stat-videos"),
    statAccounts: $("#stat-accounts"),
    statFormats: $("#stat-formats"),
    search: $("#search-input"),
    appFilter: $("#app-filter"),
    accountFilter: $("#account-filter"),
    accountOptions: $("#account-options"),
    formatFilter: $("#format-filter"),
    statusFilter: $("#status-filter"),
    sortSelect: $("#sort-select"),
    dateFrom: $("#date-from"),
    dateTo: $("#date-to"),
    clearFilters: $("#clear-filters"),
    refresh: $("#refresh-button"),
    bulkFormat: $("#bulk-format-select"),
    assignFormat: $("#assign-format-button"),
    selectedCount: $("#selected-count"),
    resultCount: $("#result-count"),
    videoRows: $("#video-rows"),
    emptyState: $("#empty-state"),
    selectPage: $("#select-page"),
    prevPage: $("#prev-page"),
    nextPage: $("#next-page"),
    pageLabel: $("#page-label"),
    formatForm: $("#format-form"),
    formatId: $("#format-id"),
    formatName: $("#format-name"),
    formatDescription: $("#format-description"),
    resetFormatForm: $("#reset-format-form"),
    formatList: $("#format-list"),
    formatTotal: $("#format-total"),
  });
}

function isOverlaySidebarViewport() {
  return window.matchMedia("(max-width: 1180px)").matches;
}

function getInitialSidebarState() {
  if (isOverlaySidebarViewport()) {
    return true;
  }

  try {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored !== null) {
      return stored === "true";
    }
  } catch {
    // Local storage can be unavailable in restricted browser contexts.
  }

  return false;
}

function setSidebarCollapsed(collapsed, persist = true) {
  state.sidebarCollapsed = collapsed;
  els.appShell.classList.toggle("sidebar-collapsed", collapsed);
  const overlayOpen = !collapsed && isOverlaySidebarViewport();
  document.documentElement.classList.toggle("sidebar-open", overlayOpen);
  els.sidebarBackdrop.hidden = !overlayOpen;
  els.sidebar.setAttribute("aria-hidden", String(collapsed));
  els.sidebar.inert = collapsed;
  els.sidebarToggle.hidden = !collapsed;
  els.sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
  els.sidebarToggle.setAttribute("aria-label", "Open sidebar");
  els.sidebarToggle.title = "Open sidebar";
  els.sidebarClose.hidden = collapsed;

  if (persist && !isOverlaySidebarViewport()) {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
    } catch {
      // Ignore storage failures; the button should still work for this session.
    }
  }
}

function syncSortSelect() {
  const value = `${state.sort}:${state.direction}`;
  if ([...els.sortSelect.options].some((option) => option.value === value)) {
    els.sortSelect.value = value;
  }
}

function compactDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseStaticInt(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(minimum, Math.min(maximum, parsed));
}

function readStaticCell(row, name) {
  return row[staticData.columns[name]];
}

function parseStaticFormatIds(value) {
  if (Array.isArray(value)) {
    return value.map(Number).filter((id) => Number.isFinite(id) && id > 0);
  }
  return String(value || "")
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isFinite(id) && id > 0);
}

function deriveBaseAssignments() {
  const assignments = new Map();
  for (const row of staticData.rows) {
    const videoId = Number(readStaticCell(row, "id"));
    const formatIds = parseStaticFormatIds(readStaticCell(row, "format_ids"));
    if (!videoId || !formatIds.length) {
      continue;
    }
    assignments.set(videoId, new Set(formatIds));
  }
  return assignments;
}

function hydrateStaticState() {
  const baseFormats = (staticData.meta.formats || []).map((format) => ({ ...format }));
  let formats = baseFormats;
  let assignments = deriveBaseAssignments();

  try {
    const stored = window.localStorage.getItem(STATIC_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed.formats) && Array.isArray(parsed.assignments)) {
        formats = parsed.formats.map((format) => ({ ...format }));
        assignments = new Map(
          parsed.assignments.map(([videoId, formatIds]) => [
            Number(videoId),
            new Set(parseStaticFormatIds(formatIds)),
          ]),
        );
      }
    }
  } catch {
    // Static mode still works if browser storage is unavailable.
  }

  staticData.formats = formats;
  staticData.assignments = assignments;
  staticData.nextFormatId =
    Math.max(0, ...formats.map((format) => Number(format.id)).filter(Number.isFinite)) + 1;
}

function persistStaticState() {
  try {
    const assignments = Array.from(staticData.assignments.entries())
      .filter(([, formatIds]) => formatIds.size > 0)
      .map(([videoId, formatIds]) => [videoId, Array.from(formatIds)]);
    window.localStorage.setItem(
      STATIC_STORAGE_KEY,
      JSON.stringify({
        formats: staticData.formats,
        assignments,
      }),
    );
  } catch {
    // Edits are best-effort in static mode.
  }
}

async function fetchStaticJson(path) {
  const response = await fetch(new URL(path, window.location.href), {
    cache: "force-cache",
  });
  if (!response.ok) {
    throw new Error(`Could not load ${path}: ${response.status}`);
  }
  return response.json();
}

async function ensureStaticData() {
  if (staticData.loaded) {
    return;
  }
  if (staticData.loading) {
    return staticData.loading;
  }

  staticData.loading = (async () => {
    const [meta, videos] = await Promise.all([
      fetchStaticJson("./data/meta.json"),
      fetchStaticJson("./data/videos.json"),
    ]);

    staticData.meta = meta;
    staticData.rows = videos.rows || [];
    staticData.columns = Object.fromEntries(
      (videos.columns || []).map((name, index) => [name, index]),
    );
    hydrateStaticState();
    staticData.loaded = true;
  })();

  return staticData.loading;
}

function buildStaticMeta() {
  const counts = new Map(staticData.formats.map((format) => [Number(format.id), 0]));
  for (const formatIds of staticData.assignments.values()) {
    for (const formatId of formatIds) {
      if (counts.has(formatId)) {
        counts.set(formatId, counts.get(formatId) + 1);
      }
    }
  }

  const formats = staticData.formats
    .map((format) => ({
      ...format,
      video_count: counts.get(Number(format.id)) || 0,
    }))
    .sort((a, b) => String(a.name).toLowerCase().localeCompare(String(b.name).toLowerCase()));

  return {
    apps: [...(staticData.meta.apps || [])],
    accounts: [...(staticData.meta.accounts || [])],
    formats,
    stats: {
      ...(staticData.meta.stats || {}),
      videos: staticData.rows.length,
      formats: formats.length,
    },
    dates: { ...(staticData.meta.dates || {}) },
    generated_at: staticData.meta.generated_at,
  };
}

function staticDateBounds(params) {
  let dateFrom = params.get("date_from") || "";
  let dateTo = params.get("date_to") || "";
  const preset = params.get("preset") || "";

  if (dateFrom || dateTo || !preset) {
    return { dateFrom, dateTo };
  }

  const today = new Date();
  if (preset === "last_30_days") {
    const start = new Date(today);
    start.setDate(start.getDate() - 30);
    dateFrom = compactDate(start);
    dateTo = compactDate(today);
  }
  if (preset === "last_90_days") {
    const start = new Date(today);
    start.setDate(start.getDate() - 90);
    dateFrom = compactDate(start);
    dateTo = compactDate(today);
  }
  if (preset === "this_month") {
    dateFrom = compactDate(new Date(today.getFullYear(), today.getMonth(), 1));
    dateTo = compactDate(today);
  }

  return { dateFrom, dateTo };
}

function staticFiltersFromParams(params) {
  const { dateFrom, dateTo } = staticDateBounds(params);
  return {
    appSlugs: String(params.get("app") || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
    account: String(params.get("account") || "").trim().toLowerCase(),
    q: String(params.get("q") || "").trim().toLowerCase(),
    dateFrom,
    dateTo,
    status: String(params.get("status") || "").trim().toLowerCase(),
    formatId: String(params.get("format_id") || "").trim(),
  };
}

function staticSearchText(row) {
  if (row._searchText !== undefined) {
    return row._searchText;
  }
  const text = [
    readStaticCell(row, "caption"),
    readStaticCell(row, "username"),
    readStaticCell(row, "video_id"),
    readStaticCell(row, "post_url"),
  ]
    .join(" ")
    .toLowerCase();
  Object.defineProperty(row, "_searchText", {
    value: text,
    enumerable: false,
  });
  return text;
}

function staticRowMatches(row, filters) {
  if (filters.appSlugs.length) {
    const slugs = String(readStaticCell(row, "app_slugs") || "").split(",");
    if (!filters.appSlugs.some((slug) => slugs.includes(slug))) {
      return false;
    }
  }

  if (filters.account && String(readStaticCell(row, "username") || "").toLowerCase() !== filters.account) {
    return false;
  }

  if (filters.q && !staticSearchText(row).includes(filters.q)) {
    return false;
  }

  const uploadDate = readStaticCell(row, "upload_date") || "";
  if (filters.dateFrom && uploadDate < filters.dateFrom) {
    return false;
  }
  if (filters.dateTo && uploadDate > filters.dateTo) {
    return false;
  }

  if (filters.status && String(readStaticCell(row, "status") || "").toLowerCase() !== filters.status) {
    return false;
  }

  if (filters.formatId) {
    const assigned = staticData.assignments.get(Number(readStaticCell(row, "id")));
    if (filters.formatId === "unassigned") {
      return !assigned || assigned.size === 0;
    }
    return Boolean(assigned && assigned.has(Number(filters.formatId)));
  }

  return true;
}

function staticSortValue(row, sort) {
  if (sort === "upload_date") {
    return readStaticCell(row, "upload_date") || "";
  }
  if (sort === "engagement") {
    return Number(readStaticCell(row, "latest_engagement_rate"));
  }
  if (sort === "username") {
    return String(readStaticCell(row, "username") || "").toLowerCase();
  }
  if (sort === "status") {
    return String(readStaticCell(row, "status") || "").toLowerCase();
  }
  if (sort === "collected") {
    return readStaticCell(row, "latest_collected_at") || "";
  }
  return Number(readStaticCell(row, "latest_views_count"));
}

function compareStaticRows(a, b, sort, direction) {
  const av = staticSortValue(a, sort);
  const bv = staticSortValue(b, sort);
  const aMissing = av === "" || av === null || av === undefined || Number.isNaN(av);
  const bMissing = bv === "" || bv === null || bv === undefined || Number.isNaN(bv);

  if (aMissing !== bMissing) {
    return aMissing ? 1 : -1;
  }

  let result = 0;
  if (av < bv) {
    result = -1;
  } else if (av > bv) {
    result = 1;
  }
  if (direction === "desc") {
    result *= -1;
  }
  return result || Number(readStaticCell(b, "id")) - Number(readStaticCell(a, "id"));
}

function getStaticSortedRows(sort, direction) {
  const sortKey = `${sort}:${direction}`;
  if (!staticData.sortCache.has(sortKey)) {
    const sorted = staticData.rows.slice();
    sorted.sort((a, b) => compareStaticRows(a, b, sort, direction));
    staticData.sortCache.set(sortKey, sorted);
  }
  return staticData.sortCache.get(sortKey);
}

function staticFormatNames(videoId) {
  const assigned = staticData.assignments.get(Number(videoId));
  if (!assigned || assigned.size === 0) {
    return "";
  }
  return staticData.formats
    .filter((format) => assigned.has(Number(format.id)))
    .map((format) => format.name)
    .join(", ");
}

function staticFormatIds(videoId) {
  const assigned = staticData.assignments.get(Number(videoId));
  if (!assigned || assigned.size === 0) {
    return "";
  }
  return Array.from(assigned).join(",");
}

function staticRowToVideo(row) {
  const id = readStaticCell(row, "id");
  return {
    id,
    platform: readStaticCell(row, "platform"),
    video_id: readStaticCell(row, "video_id"),
    username: readStaticCell(row, "username"),
    post_url: readStaticCell(row, "post_url"),
    thumbnail_url: readStaticCell(row, "thumbnail_url"),
    caption: readStaticCell(row, "caption"),
    upload_date: readStaticCell(row, "upload_date"),
    status: readStaticCell(row, "status"),
    is_active: readStaticCell(row, "is_active"),
    latest_views_text: readStaticCell(row, "latest_views_text"),
    latest_views_count: readStaticCell(row, "latest_views_count"),
    latest_engagement_rate_text: readStaticCell(row, "latest_engagement_rate_text"),
    latest_engagement_rate: readStaticCell(row, "latest_engagement_rate"),
    latest_viral_performance: readStaticCell(row, "latest_viral_performance"),
    latest_collected_at: readStaticCell(row, "latest_collected_at"),
    app_names: readStaticCell(row, "app_names"),
    app_slugs: readStaticCell(row, "app_slugs"),
    format_names: staticFormatNames(id),
    format_ids: staticFormatIds(id),
  };
}

function queryStaticVideos(params) {
  const page = parseStaticInt(params.get("page"), 1, 1, 1_000_000);
  const pageSize = parseStaticInt(params.get("page_size"), 50, 10, 200);
  const sort = params.get("sort") || "views";
  const direction = params.get("direction") === "asc" ? "asc" : "desc";
  const filters = staticFiltersFromParams(params);
  const sortedRows = getStaticSortedRows(sort, direction);
  const offset = (page - 1) * pageSize;
  const pageRows = [];
  let total = 0;

  for (const row of sortedRows) {
    if (!staticRowMatches(row, filters)) {
      continue;
    }
    if (total >= offset && pageRows.length < pageSize) {
      pageRows.push(staticRowToVideo(row));
    }
    total += 1;
  }

  return {
    rows: pageRows,
    total,
    page,
    page_size: pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

function staticPayload(options) {
  if (!options.body) {
    return {};
  }
  if (typeof options.body === "string") {
    return JSON.parse(options.body);
  }
  return options.body;
}

function todayStaticIso() {
  return compactDate(new Date());
}

function staticFormatById(formatId) {
  return staticData.formats.find((format) => Number(format.id) === Number(formatId));
}

function normalizedStaticVideoIds(payload) {
  const rawIds = Array.isArray(payload.video_ids) ? payload.video_ids : [];
  const ids = rawIds
    .map(Number)
    .filter((id) => Number.isFinite(id) && id > 0);
  const uniqueIds = Array.from(new Set(ids));
  if (!uniqueIds.length) {
    throw new Error("Select at least one video");
  }
  return uniqueIds;
}

function createStaticFormat(payload) {
  const name = String(payload.name || "").trim();
  const description = String(payload.description || "").trim();
  if (!name) {
    throw new Error("Format name is required");
  }
  if (name.length > 80) {
    throw new Error("Format name must be 80 characters or fewer");
  }
  if (staticData.formats.some((format) => String(format.name).toLowerCase() === name.toLowerCase())) {
    throw new Error("A format with this name already exists");
  }

  const now = todayStaticIso();
  const format = {
    id: staticData.nextFormatId++,
    name,
    description: description || null,
    created_at: now,
    updated_at: now,
  };
  staticData.formats.push(format);
  persistStaticState();
  return format;
}

function updateStaticFormat(formatId, payload) {
  const format = staticFormatById(formatId);
  if (!format) {
    throw new Error("Format not found");
  }

  const name = String(payload.name || "").trim();
  const description = String(payload.description || "").trim();
  if (!name) {
    throw new Error("Format name is required");
  }
  if (name.length > 80) {
    throw new Error("Format name must be 80 characters or fewer");
  }
  if (
    staticData.formats.some(
      (item) => Number(item.id) !== Number(formatId) && String(item.name).toLowerCase() === name.toLowerCase(),
    )
  ) {
    throw new Error("A format with this name already exists");
  }

  format.name = name;
  format.description = description || null;
  format.updated_at = todayStaticIso();
  persistStaticState();
  return format;
}

function deleteStaticFormat(formatId) {
  const index = staticData.formats.findIndex((format) => Number(format.id) === Number(formatId));
  if (index === -1) {
    throw new Error("Format not found");
  }
  staticData.formats.splice(index, 1);
  for (const assigned of staticData.assignments.values()) {
    assigned.delete(Number(formatId));
  }
  persistStaticState();
}

function assignStaticFormat(payload) {
  const videoIds = normalizedStaticVideoIds(payload);
  const formatId = Number(payload.format_id);
  if (!staticFormatById(formatId)) {
    throw new Error("Format not found");
  }

  for (const videoId of videoIds) {
    if (!staticData.assignments.has(videoId)) {
      staticData.assignments.set(videoId, new Set());
    }
    staticData.assignments.get(videoId).add(formatId);
  }
  persistStaticState();
  return { assigned: videoIds.length };
}

function removeStaticFormatAssignment(payload) {
  const videoIds = normalizedStaticVideoIds(payload);
  const formatId = Number(payload.format_id);
  let removed = 0;
  for (const videoId of videoIds) {
    const assigned = staticData.assignments.get(videoId);
    if (assigned && assigned.delete(formatId)) {
      removed += 1;
    }
  }
  persistStaticState();
  return { removed };
}

async function api(path, options = {}) {
  await ensureStaticData();

  const method = String(options.method || "GET").toUpperCase();
  const url = new URL(path, window.location.origin);
  const payload = staticPayload(options);

  if (method === "GET" && url.pathname === "/api/health") {
    return { ok: true, mode: "static" };
  }
  if (method === "GET" && url.pathname === "/api/meta") {
    return buildStaticMeta();
  }
  if (method === "GET" && url.pathname === "/api/videos") {
    return queryStaticVideos(url.searchParams);
  }
  if (method === "GET" && url.pathname === "/api/formats") {
    return { formats: buildStaticMeta().formats };
  }
  if (method === "POST" && url.pathname === "/api/formats") {
    return createStaticFormat(payload);
  }
  if (method === "POST" && url.pathname === "/api/video-formats") {
    return assignStaticFormat(payload);
  }
  if (method === "POST" && url.pathname === "/api/video-formats/remove") {
    return removeStaticFormatAssignment(payload);
  }

  const formatMatch = url.pathname.match(/^\/api\/formats\/(\d+)$/);
  if (formatMatch && method === "PUT") {
    return updateStaticFormat(Number(formatMatch[1]), payload);
  }
  if (formatMatch && method === "DELETE") {
    deleteStaticFormat(Number(formatMatch[1]));
    return { deleted: true };
  }

  throw new Error("Static endpoint not found");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return String(value);
  }
  return new Intl.NumberFormat().format(number);
}

function shortDate(value) {
  if (!value) {
    return "No date";
  }
  return value;
}

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function getFormatAssignments(row) {
  const ids = splitCsv(row.format_ids);
  const names = splitCsv(row.format_names);
  const formatNamesById = new Map(state.meta.formats.map((format) => [String(format.id), format.name]));

  if (ids.length) {
    return ids.map((id, index) => ({
      id,
      name: formatNamesById.get(id) || names[index] || `Format ${id}`,
    }));
  }

  return names.map((name) => ({ id: "", name }));
}

function getAvailableFormatsForVideo(videoId) {
  const row = state.currentRows.find((item) => Number(item.id) === Number(videoId));
  if (!row) {
    return [];
  }

  const assignedFormatIds = new Set(
    getFormatAssignments(row)
      .map((format) => String(format.id))
      .filter(Boolean),
  );
  return state.meta.formats.filter((format) => !assignedFormatIds.has(String(format.id)));
}

function ensureRowFormatMenu() {
  let menu = $("#row-format-menu");
  if (!menu) {
    menu = document.createElement("div");
    menu.id = "row-format-menu";
    menu.className = "row-format-menu";
    menu.hidden = true;
    menu.setAttribute("role", "menu");
    document.body.append(menu);
  }
  return menu;
}

function closeRowFormatMenu(options = {}) {
  const menu = $("#row-format-menu");
  if (!menu || menu.hidden) {
    return;
  }

  const trigger = state.activeFormatTrigger;
  if (trigger) {
    trigger.setAttribute("aria-expanded", "false");
  }

  menu.hidden = true;
  menu.classList.remove("is-open", "is-above");
  menu.innerHTML = "";
  state.activeFormatTrigger = null;

  if (options.restoreFocus && trigger?.isConnected) {
    trigger.focus();
  }
}

function positionRowFormatMenu(trigger) {
  const menu = ensureRowFormatMenu();
  const rect = trigger.getBoundingClientRect();
  const width = Math.max(180, Math.min(280, window.innerWidth - 24));
  const maxLeft = Math.max(12, window.innerWidth - width - 12);
  const left = Math.min(maxLeft, Math.max(12, rect.left));
  const preferredTop = rect.bottom + 8;

  menu.style.width = `${width}px`;
  menu.style.left = `${left}px`;
  menu.style.top = `${preferredTop}px`;

  const menuRect = menu.getBoundingClientRect();
  if (preferredTop + menuRect.height > window.innerHeight - 12 && rect.top > menuRect.height + 20) {
    menu.style.top = `${rect.top - menuRect.height - 8}px`;
    menu.classList.add("is-above");
  } else {
    menu.classList.remove("is-above");
  }
}

function openRowFormatMenu(trigger) {
  if (trigger.disabled) {
    return;
  }

  const menu = ensureRowFormatMenu();
  if (state.activeFormatTrigger === trigger && !menu.hidden) {
    closeRowFormatMenu({ restoreFocus: true });
    return;
  }

  closeRowFormatMenu();

  const videoId = trigger.dataset.videoId;
  const availableFormats = getAvailableFormatsForVideo(videoId);
  if (!availableFormats.length) {
    showToast(state.meta.formats.length ? "All formats are assigned." : "Create a format first.");
    return;
  }

  menu.dataset.videoId = videoId;
  menu.innerHTML = `
    <div class="row-format-menu-header">Add format</div>
    <div class="row-format-menu-list" role="none">
      ${availableFormats
        .map((format) => {
          return `
            <button class="row-format-option" type="button" role="menuitem" data-format-id="${escapeHtml(format.id)}">
              <span class="row-format-option-name">${escapeHtml(format.name)}</span>
              <span class="row-format-option-count">${formatNumber(format.video_count || 0)} videos</span>
            </button>
          `;
        })
        .join("")}
    </div>
  `;

  state.activeFormatTrigger = trigger;
  trigger.setAttribute("aria-expanded", "true");
  menu.hidden = false;
  menu.style.visibility = "hidden";
  positionRowFormatMenu(trigger);
  menu.style.visibility = "";
  window.requestAnimationFrame(() => menu.classList.add("is-open"));
  menu.querySelector(".row-format-option")?.focus({ preventScroll: true });
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.remove("is-visible");
  }, 2600);
}

function setView(view) {
  $all(".nav-tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === view);
  });
  $all(".view").forEach((section) => {
    section.classList.toggle("is-active", section.id === `${view}-view`);
  });
  const viewLabel = view === "formats" ? "Format Library" : "Video Catalog";
  els.viewLabel.textContent = viewLabel;
  document.title = `${BRAND_NAME} - ${viewLabel}`;

  if (view === "formats") {
    renderFormats();
  } else {
    loadVideos();
  }
}

async function loadMeta() {
  state.meta = await api("/api/meta");
  renderMeta();
}

function renderMeta() {
  const stats = state.meta.stats || {};
  els.statVideos.textContent = formatNumber(stats.videos || 0);
  els.statAccounts.textContent = formatNumber(stats.accounts || 0);
  els.statFormats.textContent = formatNumber(stats.formats || 0);

  els.appFilter.innerHTML = [
    `<option value="">All apps</option>`,
    ...state.meta.apps.map((app) => {
      return `<option value="${escapeHtml(app.slug)}">${escapeHtml(app.name)} (${formatNumber(app.video_count)})</option>`;
    }),
  ].join("");

  els.accountOptions.innerHTML = state.meta.accounts
    .map((account) => {
      return `<option value="${escapeHtml(account.username)}">${escapeHtml(account.username)} (${formatNumber(account.video_count)})</option>`;
    })
    .join("");

  renderFormatSelects();
  renderFormats();
}

function renderFormatSelects() {
  const baseOptions = state.meta.formats
    .map((format) => `<option value="${format.id}">${escapeHtml(format.name)} (${formatNumber(format.video_count)})</option>`)
    .join("");

  const currentFilterValue = els.formatFilter.value;
  const currentBulkValue = els.bulkFormat.value;

  els.formatFilter.innerHTML = [
    `<option value="">All formats</option>`,
    `<option value="unassigned">Unassigned</option>`,
    baseOptions,
  ].join("");
  els.bulkFormat.innerHTML = [`<option value="">Choose format</option>`, baseOptions].join("");

  if ([...els.formatFilter.options].some((option) => option.value === currentFilterValue)) {
    els.formatFilter.value = currentFilterValue;
  }
  if ([...els.bulkFormat.options].some((option) => option.value === currentBulkValue)) {
    els.bulkFormat.value = currentBulkValue;
  }

  els.formatTotal.textContent = `${state.meta.formats.length} total`;
}

function readFilters() {
  const params = new URLSearchParams();
  params.set("page", state.page);
  params.set("page_size", state.pageSize);
  params.set("sort", state.sort);
  params.set("direction", state.direction);

  const filters = {
    q: els.search.value.trim(),
    app: els.appFilter.value,
    account: els.accountFilter.value.trim(),
    format_id: els.formatFilter.value,
    status: els.statusFilter.value,
    date_from: els.dateFrom.value,
    date_to: els.dateTo.value,
    preset: $(".segmented button.is-active")?.dataset.preset || "",
  };

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  return params;
}

async function loadVideos() {
  els.videoRows.innerHTML = `<tr><td colspan="8" class="subtle">Loading videos...</td></tr>`;
  els.emptyState.hidden = true;

  try {
    const data = await api(`/api/videos?${readFilters().toString()}`);
    state.currentRows = data.rows;
    state.pages = data.pages;
    renderVideos(data);
  } catch (error) {
    els.videoRows.innerHTML = `<tr><td colspan="8" class="subtle">${escapeHtml(error.message)}</td></tr>`;
  }
}

function renderVideos(data) {
  closeRowFormatMenu();
  const total = data.total || 0;
  els.resultCount.textContent = `${formatNumber(total)} videos`;
  els.pageLabel.textContent = `Page ${data.page} of ${data.pages}`;
  els.prevPage.disabled = data.page <= 1;
  els.nextPage.disabled = data.page >= data.pages;

  if (!data.rows.length) {
    els.videoRows.innerHTML = "";
    els.emptyState.hidden = false;
    updateSelectionUi();
    return;
  }

  els.emptyState.hidden = true;
  els.videoRows.innerHTML = data.rows.map(renderVideoRow).join("");
  updateSelectionUi();
}

function renderVideoRow(row) {
  const appPills = splitCsv(row.app_names)
    .map((name) => `<span class="pill app">${escapeHtml(name)}</span>`)
    .join("");
  const formatAssignments = getFormatAssignments(row);
  const assignedFormatIds = new Set(formatAssignments.map((format) => String(format.id)).filter(Boolean));
  const formatPills = formatAssignments
    .map((format) => {
      const removeButton = format.id
        ? `
          <button
            class="tag-remove"
            data-video-id="${escapeHtml(row.id)}"
            data-format-id="${escapeHtml(format.id)}"
            type="button"
            aria-label="Remove ${escapeHtml(format.name)} from this video"
            title="Remove format"
          >&times;</button>
        `
        : "";
      return `
        <span class="pill format format-tag">
          <span class="format-tag-name">${escapeHtml(format.name)}</span>
          ${removeButton}
        </span>
      `;
    })
    .join("");
  const selected = state.selected.has(Number(row.id)) ? "checked" : "";
  const thumbnail = row.thumbnail_url
    ? `<img class="thumb" src="${escapeHtml(row.thumbnail_url)}" alt="" loading="lazy" />`
    : `<div class="thumb" aria-hidden="true"></div>`;
  const availableFormats = state.meta.formats.filter((format) => !assignedFormatIds.has(String(format.id)));
  const addFormatTitle = !state.meta.formats.length
    ? "Create a format first"
    : availableFormats.length
      ? "Add format"
      : "All formats assigned";
  const addFormatDisabled = availableFormats.length ? "" : "disabled";
  const hasFormatAssignments = formatAssignments.length > 0;
  const addFormatButtonClass = hasFormatAssignments
    ? "row-format-trigger row-format-trigger--tag"
    : "row-format-trigger row-format-trigger--empty";
  const addFormatButton = `
    <button
      class="${addFormatButtonClass}"
      data-video-id="${escapeHtml(row.id)}"
      type="button"
      aria-label="Add format"
      aria-haspopup="menu"
      aria-expanded="false"
      title="${escapeHtml(addFormatTitle)}"
      ${addFormatDisabled}
    >
      <span aria-hidden="true">+</span>
    </button>
  `;
  const videoUrlButton = row.post_url
    ? `<a class="video-url-button" href="${escapeHtml(row.post_url)}" target="_blank" rel="noreferrer" title="Open video URL">URL</a>`
    : "";

  return `
    <tr data-video-id="${row.id}">
      <td class="check-cell">
        <input class="row-check" type="checkbox" data-video-id="${row.id}" ${selected} aria-label="Select video" />
      </td>
      <td class="video-detail-cell">
        <div class="video-cell">
          ${thumbnail}
          <div>
            <div class="caption">${escapeHtml(row.caption || "No caption")}</div>
            <div class="meta-line video-meta-line">
              <span>${escapeHtml(row.video_id || "")}</span>
              ${videoUrlButton}
            </div>
          </div>
        </div>
      </td>
      <td data-label="Account">
        <strong>${escapeHtml(row.username || "Unknown")}</strong>
        <div class="subtle">${escapeHtml(row.platform || "")}</div>
      </td>
      <td data-label="App"><div class="pill-row">${appPills || `<span class="subtle">None</span>`}</div></td>
      <td data-label="Views">
        <div class="num">${escapeHtml(row.latest_views_text || formatNumber(row.latest_views_count) || "0")}</div>
        <div class="subtle">${formatNumber(row.latest_views_count)}</div>
      </td>
      <td data-label="Eng.">
        <strong>${escapeHtml(row.latest_engagement_rate_text || "")}</strong>
        <div class="subtle">${escapeHtml(row.latest_viral_performance || "")}</div>
      </td>
      <td data-label="Date">
        <strong>${escapeHtml(shortDate(row.upload_date))}</strong>
        <div class="subtle">${escapeHtml(row.status || "")}</div>
      </td>
      <td data-label="Formats">
        <div class="format-cell">
          <div class="pill-row format-pill-row">
            ${formatPills}
            ${addFormatButton}
          </div>
        </div>
      </td>
    </tr>
  `;
}

function updateSelectionUi() {
  els.selectedCount.textContent = state.selected.size;
  const pageIds = state.currentRows.map((row) => Number(row.id));
  const selectedOnPage = pageIds.filter((id) => state.selected.has(id));
  els.selectPage.checked = pageIds.length > 0 && selectedOnPage.length === pageIds.length;
  els.selectPage.indeterminate = selectedOnPage.length > 0 && selectedOnPage.length < pageIds.length;
}

async function assignSelectedFormat() {
  const formatId = els.bulkFormat.value;
  if (!formatId) {
    showToast("Choose a format first.");
    return;
  }
  if (state.selected.size === 0) {
    showToast("Select at least one video.");
    return;
  }

  await api("/api/video-formats", {
    method: "POST",
    body: JSON.stringify({
      format_id: Number(formatId),
      video_ids: Array.from(state.selected),
    }),
  });
  showToast(`Assigned ${state.selected.size} video${state.selected.size === 1 ? "" : "s"}.`);
  state.selected.clear();
  await loadMeta();
  await loadVideos();
}

async function assignOneFormat(videoId, formatId) {
  if (!formatId) {
    return;
  }
  await api("/api/video-formats", {
    method: "POST",
    body: JSON.stringify({
      format_id: Number(formatId),
      video_ids: [Number(videoId)],
    }),
  });
  showToast("Format assigned.");
  await loadMeta();
  await loadVideos();
}

async function removeOneFormat(videoId, formatId) {
  if (!formatId) {
    return;
  }
  await api("/api/video-formats/remove", {
    method: "POST",
    body: JSON.stringify({
      format_id: Number(formatId),
      video_ids: [Number(videoId)],
    }),
  });
  showToast("Format removed.");
  await loadMeta();
  await loadVideos();
}

function renderFormats() {
  renderFormatSelects();
  if (!state.meta.formats.length) {
    els.formatList.innerHTML = `<div class="empty-state"><strong>No formats yet.</strong><span>No saved format records.</span></div>`;
    return;
  }

  els.formatList.innerHTML = state.meta.formats
    .map((format) => {
      return `
        <article class="format-item" data-format-id="${format.id}">
          <div>
            <h3>${escapeHtml(format.name)}</h3>
            <p>${escapeHtml(format.description || "No description")}</p>
            <div class="format-count">${formatNumber(format.video_count)} video${Number(format.video_count) === 1 ? "" : "s"} assigned</div>
          </div>
          <div class="format-actions">
            <button class="mini-action" data-action="open" data-format-id="${format.id}" type="button">Open Videos</button>
            <button class="mini-action" data-action="edit" data-format-id="${format.id}" type="button">Edit</button>
            <button class="mini-action delete" data-action="delete" data-format-id="${format.id}" type="button">Delete</button>
          </div>
        </article>
      `;
    })
    .join("");
}

async function saveFormat(event) {
  event.preventDefault();
  const payload = {
    name: els.formatName.value.trim(),
    description: els.formatDescription.value.trim(),
  };
  const id = els.formatId.value;
  if (!payload.name) {
    showToast("Name is required.");
    return;
  }

  if (id) {
    await api(`/api/formats/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    showToast("Format updated.");
  } else {
    await api("/api/formats", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    showToast("Format created.");
  }

  resetFormatForm();
  await loadMeta();
}

function resetFormatForm() {
  els.formatId.value = "";
  els.formatName.value = "";
  els.formatDescription.value = "";
}

function editFormat(formatId) {
  const format = state.meta.formats.find((item) => Number(item.id) === Number(formatId));
  if (!format) {
    return;
  }
  els.formatId.value = format.id;
  els.formatName.value = format.name;
  els.formatDescription.value = format.description || "";
  els.formatName.focus();
}

async function deleteFormat(formatId) {
  const format = state.meta.formats.find((item) => Number(item.id) === Number(formatId));
  if (!format) {
    return;
  }
  if (!window.confirm(`Delete "${format.name}" and remove its assignments?`)) {
    return;
  }

  await api(`/api/formats/${formatId}`, { method: "DELETE" });
  showToast("Format deleted.");
  await loadMeta();
}

function clearFilters() {
  els.search.value = "";
  els.appFilter.value = "";
  els.accountFilter.value = "";
  els.formatFilter.value = "";
  els.statusFilter.value = "";
  state.sort = "views";
  state.direction = "desc";
  syncSortSelect();
  els.dateFrom.value = "";
  els.dateTo.value = "";
  setPreset("");
  state.page = 1;
  loadVideos();
}

function setPreset(preset) {
  $all(".segmented button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.preset === preset);
  });
}

function openFormatInTable(formatId) {
  if (!formatId) {
    return;
  }
  els.formatFilter.value = String(formatId);
  state.page = 1;
  setView("videos");
}

function bindEvents() {
  els.sidebarToggle.addEventListener("click", () => {
    setSidebarCollapsed(false);
    els.sidebarClose.focus();
  });

  els.sidebarClose.addEventListener("click", () => {
    setSidebarCollapsed(true);
    els.sidebarToggle.focus();
  });

  els.sidebarBackdrop.addEventListener("click", () => {
    setSidebarCollapsed(true);
    els.sidebarToggle.focus();
  });

  $all(".nav-tab").forEach((button) => {
    button.addEventListener("click", () => {
      setView(button.dataset.view);
      if (isOverlaySidebarViewport()) {
        setSidebarCollapsed(true);
      }
    });
  });

  els.refresh.addEventListener("click", async () => {
    await loadMeta();
    await loadVideos();
    showToast("Data refreshed.");
  });

  els.search.addEventListener("input", () => {
    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(() => {
      state.page = 1;
      loadVideos();
    }, 250);
  });

  [els.appFilter, els.accountFilter, els.formatFilter, els.statusFilter].forEach((input) => {
    input.addEventListener("change", () => {
      state.page = 1;
      loadVideos();
    });
  });

  els.sortSelect.addEventListener("change", () => {
    const [sort, direction] = els.sortSelect.value.split(":");
    state.sort = sort || "views";
    state.direction = direction || "desc";
    state.page = 1;
    loadVideos();
  });

  [els.dateFrom, els.dateTo].forEach((input) => {
    input.addEventListener("change", () => {
      setPreset("");
      state.page = 1;
      loadVideos();
    });
  });

  $all(".segmented button").forEach((button) => {
    button.addEventListener("click", () => {
      setPreset(button.dataset.preset);
      els.dateFrom.value = "";
      els.dateTo.value = "";
      state.page = 1;
      loadVideos();
    });
  });

  els.clearFilters.addEventListener("click", clearFilters);

  $all(".sort-button").forEach((button) => {
    button.addEventListener("click", () => {
      const nextSort = button.dataset.sort;
      if (state.sort === nextSort) {
        state.direction = state.direction === "desc" ? "asc" : "desc";
      } else {
        state.sort = nextSort;
        state.direction = "desc";
      }
      syncSortSelect();
      state.page = 1;
      loadVideos();
    });
  });

  els.prevPage.addEventListener("click", () => {
    if (state.page > 1) {
      state.page -= 1;
      loadVideos();
    }
  });

  els.nextPage.addEventListener("click", () => {
    if (state.page < state.pages) {
      state.page += 1;
      loadVideos();
    }
  });

  els.selectPage.addEventListener("change", () => {
    state.currentRows.forEach((row) => {
      const id = Number(row.id);
      if (els.selectPage.checked) {
        state.selected.add(id);
      } else {
        state.selected.delete(id);
      }
    });
    renderVideos({
      rows: state.currentRows,
      total: Number(els.resultCount.textContent.replace(/[^0-9]/g, "")) || state.currentRows.length,
      page: state.page,
      pages: state.pages,
    });
  });

  els.videoRows.addEventListener("change", async (event) => {
    const target = event.target;
    if (target.classList.contains("row-check")) {
      const id = Number(target.dataset.videoId);
      if (target.checked) {
        state.selected.add(id);
      } else {
        state.selected.delete(id);
      }
      updateSelectionUi();
    }
  });

  els.videoRows.addEventListener("click", async (event) => {
    const target = event.target instanceof Element ? event.target : event.target.parentElement;
    if (!target) {
      return;
    }

    const trigger = target.closest(".row-format-trigger");
    if (trigger) {
      event.preventDefault();
      event.stopPropagation();
      openRowFormatMenu(trigger);
      return;
    }

    const button = target.closest(".tag-remove");
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    closeRowFormatMenu();

    button.disabled = true;
    try {
      await removeOneFormat(button.dataset.videoId, button.dataset.formatId);
    } catch (error) {
      button.disabled = false;
      showToast(error.message);
    }
  });

  document.addEventListener("click", async (event) => {
    const target = event.target instanceof Element ? event.target : event.target.parentElement;
    if (!target) {
      closeRowFormatMenu();
      return;
    }

    const option = target.closest(".row-format-option");
    if (option) {
      event.preventDefault();
      const menu = ensureRowFormatMenu();
      const videoId = menu.dataset.videoId;
      const formatId = option.dataset.formatId;
      option.disabled = true;
      closeRowFormatMenu();
      try {
        await assignOneFormat(videoId, formatId);
      } catch (error) {
        showToast(error.message);
      }
      return;
    }

    if (
      !target.closest("#row-format-menu") &&
      !target.closest(".row-format-trigger")
    ) {
      closeRowFormatMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    const menu = $("#row-format-menu");
    if (!menu || menu.hidden) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeRowFormatMenu({ restoreFocus: true });
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }

    const options = Array.from(menu.querySelectorAll(".row-format-option:not(:disabled)"));
    if (!options.length) {
      return;
    }

    event.preventDefault();
    const currentIndex = options.indexOf(document.activeElement);
    const offset = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = currentIndex === -1
      ? 0
      : (currentIndex + offset + options.length) % options.length;
    options[nextIndex].focus();
  });

  window.addEventListener("resize", () => {
    const overlayViewport = isOverlaySidebarViewport();
    const shouldCollapse = overlayViewport && !state.lastOverlaySidebarViewport;
    setSidebarCollapsed(shouldCollapse ? true : state.sidebarCollapsed, false);
    state.lastOverlaySidebarViewport = overlayViewport;

    if (state.activeFormatTrigger?.isConnected) {
      positionRowFormatMenu(state.activeFormatTrigger);
    }
  });

  window.addEventListener("scroll", (event) => {
    if (event.target instanceof Element && event.target.closest("#row-format-menu")) {
      return;
    }
    closeRowFormatMenu();
  }, true);

  els.assignFormat.addEventListener("click", () => {
    assignSelectedFormat().catch((error) => showToast(error.message));
  });

  els.formatForm.addEventListener("submit", (event) => {
    saveFormat(event).catch((error) => showToast(error.message));
  });

  els.resetFormatForm.addEventListener("click", resetFormatForm);

  els.formatList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }
    const formatId = button.dataset.formatId;
    const action = button.dataset.action;
    if (action === "open") {
      openFormatInTable(formatId);
    }
    if (action === "edit") {
      editFormat(formatId);
    }
    if (action === "delete") {
      deleteFormat(formatId).catch((error) => showToast(error.message));
    }
  });

}

async function init() {
  rememberElements();
  document.title = `${BRAND_NAME} - ${els.viewLabel.textContent}`;
  els.videoRows.innerHTML = `<tr><td colspan="8" class="subtle">Loading static data...</td></tr>`;
  state.lastOverlaySidebarViewport = isOverlaySidebarViewport();
  setSidebarCollapsed(getInitialSidebarState(), false);
  syncSortSelect();
  bindEvents();
  try {
    await loadMeta();
    await loadVideos();
  } catch (error) {
    showToast(error.message);
  }
}

document.addEventListener("DOMContentLoaded", init);
