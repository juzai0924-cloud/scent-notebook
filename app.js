const DB_NAME = "scent-notebook-v2";
const DB_VERSION = 1;
const STORE_NAME = "records";

const elements = {
  recordList: document.querySelector("#recordList"),
  emptyState: document.querySelector("#emptyState"),
  recordCount: document.querySelector("#recordCount"),
  searchInput: document.querySelector("#searchInput"),
  editorDialog: document.querySelector("#editorDialog"),
  detailDialog: document.querySelector("#detailDialog"),
  dataDialog: document.querySelector("#dataDialog"),
  form: document.querySelector("#recordForm"),
  editorTitle: document.querySelector("#editorTitle"),
  recordId: document.querySelector("#recordId"),
  imageInput: document.querySelector("#imageInput"),
  imagePreview: document.querySelector("#imagePreview"),
  imagePlaceholder: document.querySelector("#imagePlaceholder"),
  removeImageButton: document.querySelector("#removeImageButton"),
  nameInput: document.querySelector("#nameInput"),
  categoryInput: document.querySelector("#categoryInput"),
  brandInput: document.querySelector("#brandInput"),
  descriptionInput: document.querySelector("#descriptionInput"),
  descriptionCount: document.querySelector("#descriptionCount"),
  ratingInput: document.querySelector("#ratingInput"),
  topNoteInput: document.querySelector("#topNoteInput"),
  middleNoteInput: document.querySelector("#middleNoteInput"),
  baseNoteInput: document.querySelector("#baseNoteInput"),
  selectedTags: document.querySelector("#selectedTags"),
  quickTags: document.querySelector("#quickTags"),
  customTagInput: document.querySelector("#customTagInput"),
  occasionInput: document.querySelector("#occasionInput"),
  seasonInput: document.querySelector("#seasonInput"),
  detailImage: document.querySelector("#detailImage"),
  detailImageFallback: document.querySelector("#detailImageFallback"),
  detailCategory: document.querySelector("#detailCategory"),
  detailDate: document.querySelector("#detailDate"),
  detailBrand: document.querySelector("#detailBrand"),
  detailName: document.querySelector("#detailName"),
  detailRating: document.querySelector("#detailRating"),
  detailDescription: document.querySelector("#detailDescription"),
  detailNotesSection: document.querySelector("#detailNotesSection"),
  detailNotes: document.querySelector("#detailNotes"),
  detailTagsSection: document.querySelector("#detailTagsSection"),
  detailTags: document.querySelector("#detailTags"),
  detailContextSection: document.querySelector("#detailContextSection"),
  detailContext: document.querySelector("#detailContext"),
  dataRecordCount: document.querySelector("#dataRecordCount"),
  importDataInput: document.querySelector("#importDataInput"),
  toast: document.querySelector("#toast"),
};

let records = [];
let activeRecordId = null;
let pendingImage = "";
let pendingRating = 0;
let pendingTags = [];
let toastTimer = null;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, operation) {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = operation(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

const storage = {
  getAll: () => withStore("readonly", (store) => store.getAll()),
  put: (record) => withStore("readwrite", (store) => store.put(record)),
  delete: (id) => withStore("readwrite", (store) => store.delete(id)),
};

function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("visible"), 1800);
}

function openDataDialog() {
  elements.dataRecordCount.textContent = String(records.length);
  elements.dataDialog.showModal();
}

function exportData() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    records,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `气味簿备份-${date}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("备份文件已导出");
}

function normalizeImportedRecord(record) {
  if (!record || typeof record !== "object") return null;
  if (typeof record.name !== "string" || !record.name.trim()) return null;
  if (typeof record.description !== "string" || !record.description.trim()) return null;

  const now = new Date().toISOString();
  return {
    id: typeof record.id === "string" && record.id ? record.id : crypto.randomUUID(),
    name: record.name.trim().slice(0, 60),
    category: typeof record.category === "string" && record.category ? record.category : "其他",
    brand: typeof record.brand === "string" ? record.brand.trim().slice(0, 50) : "",
    description: record.description.trim().slice(0, 1000),
    rating: Math.min(5, Math.max(0, Number(record.rating) || 0)),
    topNote: typeof record.topNote === "string" ? record.topNote.slice(0, 60) : "",
    middleNote: typeof record.middleNote === "string" ? record.middleNote.slice(0, 60) : "",
    baseNote: typeof record.baseNote === "string" ? record.baseNote.slice(0, 60) : "",
    tags: Array.isArray(record.tags)
      ? [...new Set(record.tags.filter((tag) => typeof tag === "string").map((tag) => tag.trim().slice(0, 20)).filter(Boolean))].slice(0, 20)
      : [],
    occasion: typeof record.occasion === "string" ? record.occasion : "",
    season: typeof record.season === "string" ? record.season : "",
    image: typeof record.image === "string" && record.image.startsWith("data:image/") ? record.image : "",
    createdAt: record.createdAt && !Number.isNaN(Date.parse(record.createdAt)) ? record.createdAt : now,
    updatedAt: record.updatedAt && !Number.isNaN(Date.parse(record.updatedAt)) ? record.updatedAt : now,
  };
}

async function importData(file) {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const sourceRecords = Array.isArray(parsed) ? parsed : parsed.records;
    if (!Array.isArray(sourceRecords)) throw new Error("备份格式不正确");

    const importedRecords = sourceRecords.map(normalizeImportedRecord).filter(Boolean);
    if (sourceRecords.length > 0 && importedRecords.length === 0) throw new Error("没有可导入的有效记录");

    for (const record of importedRecords) await storage.put(record);
    await reloadRecords();
    elements.dataRecordCount.textContent = String(records.length);
    showToast(`已导入 ${importedRecords.length} 条记录`);
  } catch (error) {
    console.error(error);
    showToast(error.message || "导入失败，请检查文件");
  } finally {
    elements.importDataInput.value = "";
  }
}

function filteredRecords() {
  const keyword = elements.searchInput.value.trim().toLocaleLowerCase("zh-CN");
  if (!keyword) return records;

  return records.filter((record) =>
    [record.name, record.brand, record.category, record.description]
      .filter(Boolean)
      .some((value) => value.toLocaleLowerCase("zh-CN").includes(keyword)),
  );
}

function renderRecords() {
  const visibleRecords = filteredRecords();
  const hasAnyRecords = records.length > 0;

  elements.emptyState.hidden = hasAnyRecords || Boolean(elements.searchInput.value.trim());
  elements.recordCount.textContent = elements.searchInput.value.trim()
    ? `找到 ${visibleRecords.length} 条记录`
    : `${records.length} 条记录`;

  if (hasAnyRecords && visibleRecords.length === 0) {
    elements.recordList.innerHTML = `
      <div class="empty-state">
        <div class="empty-mark" aria-hidden="true">寻</div>
        <h2>没有找到对应记录</h2>
        <p>换一个名称、品牌或描述关键词试试。</p>
      </div>
    `;
    return;
  }

  elements.recordList.innerHTML = visibleRecords
    .map(
      (record) => `
        <article class="record-card" data-record-id="${escapeHtml(record.id)}" tabindex="0" role="button" aria-label="查看${escapeHtml(record.name)}的气味记录">
          ${
            record.image
              ? `<img class="card-image" src="${record.image}" alt="${escapeHtml(record.name)}" />`
              : `<div class="card-image-fallback" aria-hidden="true">${escapeHtml(record.category.slice(0, 2))}</div>`
          }
          <div class="card-content">
            <div class="card-meta">
              <span class="category-pill">${escapeHtml(record.category)}</span>
              <time class="card-date" datetime="${escapeHtml(record.createdAt)}">${formatDate(record.createdAt)}</time>
            </div>
            ${record.brand ? `<p class="card-brand">${escapeHtml(record.brand)}</p>` : ""}
            <h2 class="card-title">${escapeHtml(record.name)}</h2>
            ${record.rating ? `<div class="card-rating" aria-label="${record.rating}分">${"★".repeat(record.rating)}${"☆".repeat(5 - record.rating)}</div>` : ""}
            <p class="card-description">${escapeHtml(record.description)}</p>
          </div>
        </article>
      `,
    )
    .join("");
}

async function reloadRecords() {
  records = (await storage.getAll()).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  renderRecords();
}

function resetEditor() {
  elements.form.reset();
  elements.recordId.value = "";
  elements.categoryInput.value = "香水";
  elements.editorTitle.textContent = "新建记录";
  pendingImage = "";
  pendingRating = 0;
  pendingTags = [];
  updateImagePreview();
  updateRatingInput();
  renderTagInput();
  updateDescriptionCount();
}

function updateImagePreview() {
  const hasImage = Boolean(pendingImage);
  elements.imagePreview.hidden = !hasImage;
  elements.imagePlaceholder.hidden = hasImage;
  elements.removeImageButton.hidden = !hasImage;
  elements.imagePreview.src = pendingImage;
}

function openCreateEditor() {
  resetEditor();
  elements.editorDialog.showModal();
}

function openEditEditor(record) {
  elements.recordId.value = record.id;
  elements.nameInput.value = record.name;
  elements.categoryInput.value = record.category;
  elements.brandInput.value = record.brand || "";
  elements.descriptionInput.value = record.description;
  elements.topNoteInput.value = record.topNote || "";
  elements.middleNoteInput.value = record.middleNote || "";
  elements.baseNoteInput.value = record.baseNote || "";
  elements.occasionInput.value = record.occasion || "";
  elements.seasonInput.value = record.season || "";
  elements.editorTitle.textContent = "编辑记录";
  pendingImage = record.image || "";
  pendingRating = Number(record.rating) || 0;
  pendingTags = Array.isArray(record.tags) ? [...record.tags] : [];
  updateImagePreview();
  updateRatingInput();
  renderTagInput();
  updateDescriptionCount();
  elements.editorDialog.showModal();
}

function openDetails(record) {
  activeRecordId = record.id;
  elements.detailCategory.textContent = record.category;
  elements.detailDate.textContent = formatDate(record.createdAt);
  elements.detailDate.dateTime = record.createdAt;
  elements.detailBrand.textContent = record.brand || "";
  elements.detailBrand.hidden = !record.brand;
  elements.detailName.textContent = record.name;
  elements.detailRating.textContent = record.rating ? `${"★".repeat(record.rating)}${"☆".repeat(5 - record.rating)}` : "";
  elements.detailDescription.textContent = record.description;

  const notes = [
    ["前调", record.topNote],
    ["中调", record.middleNote],
    ["后调", record.baseNote],
  ];
  const hasNotes = notes.some(([, value]) => Boolean(value));
  elements.detailNotesSection.hidden = !hasNotes;
  elements.detailNotes.innerHTML = hasNotes
    ? notes.map(([label, value]) => `<div class="detail-note"><small>${label}</small><span>${escapeHtml(value || "—")}</span></div>`).join("")
    : "";

  const tags = Array.isArray(record.tags) ? record.tags : [];
  elements.detailTagsSection.hidden = tags.length === 0;
  elements.detailTags.innerHTML = tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");

  const contexts = [record.occasion, record.season].filter(Boolean);
  elements.detailContextSection.hidden = contexts.length === 0;
  elements.detailContext.innerHTML = contexts.map((value) => `<span>${escapeHtml(value)}</span>`).join("");

  const hasImage = Boolean(record.image);
  elements.detailImage.hidden = !hasImage;
  elements.detailImageFallback.hidden = hasImage;
  elements.detailImage.src = record.image || "";
  elements.detailImage.alt = hasImage ? record.name : "";

  elements.detailDialog.showModal();
}

function updateDescriptionCount() {
  elements.descriptionCount.textContent = elements.descriptionInput.value.length;
}

function updateRatingInput() {
  elements.ratingInput.querySelectorAll("[data-rating]").forEach((button) => {
    const value = Number(button.dataset.rating);
    button.classList.toggle("active", value <= pendingRating);
    button.setAttribute("aria-pressed", String(value === pendingRating));
  });
}

function addTag(tag) {
  const normalized = tag.trim().replaceAll(",", "").slice(0, 20);
  if (!normalized || pendingTags.includes(normalized)) return;
  pendingTags.push(normalized);
  renderTagInput();
}

function removeTag(tag) {
  pendingTags = pendingTags.filter((item) => item !== tag);
  renderTagInput();
}

function renderTagInput() {
  elements.selectedTags.innerHTML = pendingTags
    .map((tag) => `<button class="selected-tag" type="button" data-remove-tag="${escapeHtml(tag)}" aria-label="移除标签${escapeHtml(tag)}">${escapeHtml(tag)}</button>`)
    .join("");

  elements.quickTags.querySelectorAll("[data-tag]").forEach((button) => {
    button.classList.toggle("active", pendingTags.includes(button.dataset.tag));
  });
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("图片格式暂不支持"));
      image.onload = () => {
        const maxDimension = 1600;
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function saveRecord(event) {
  event.preventDefault();

  if (!elements.form.reportValidity()) return;

  const existing = records.find((record) => record.id === elements.recordId.value);
  const now = new Date().toISOString();
  const record = {
    id: existing?.id || crypto.randomUUID(),
    name: elements.nameInput.value.trim(),
    category: elements.categoryInput.value,
    brand: elements.brandInput.value.trim(),
    description: elements.descriptionInput.value.trim(),
    rating: pendingRating,
    topNote: elements.topNoteInput.value.trim(),
    middleNote: elements.middleNoteInput.value.trim(),
    baseNote: elements.baseNoteInput.value.trim(),
    tags: [...pendingTags],
    occasion: elements.occasionInput.value,
    season: elements.seasonInput.value,
    image: pendingImage,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  try {
    await storage.put(record);
    elements.editorDialog.close();
    await reloadRecords();
    showToast(existing ? "记录已更新" : "气味已记下");
  } catch (error) {
    console.error(error);
    showToast("保存失败，请稍后再试");
  }
}

async function deleteActiveRecord() {
  const record = records.find((item) => item.id === activeRecordId);
  if (!record) return;

  const confirmed = window.confirm(`确定删除“${record.name}”吗？删除后无法恢复。`);
  if (!confirmed) return;

  try {
    await storage.delete(record.id);
    elements.detailDialog.close();
    activeRecordId = null;
    await reloadRecords();
    showToast("记录已删除");
  } catch (error) {
    console.error(error);
    showToast("删除失败，请稍后再试");
  }
}

document.querySelectorAll("#openCreateButton, #emptyCreateButton, #floatingCreateButton").forEach((button) => {
  button.addEventListener("click", openCreateEditor);
});

document.querySelector("#cancelEditorButton").addEventListener("click", () => elements.editorDialog.close());
document.querySelector("#closeDetailButton").addEventListener("click", () => elements.detailDialog.close());
document.querySelector("#openDataButton").addEventListener("click", openDataDialog);
document.querySelector("#closeDataButton").addEventListener("click", () => elements.dataDialog.close());
document.querySelector("#exportDataButton").addEventListener("click", exportData);
elements.importDataInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) importData(file);
});

elements.form.addEventListener("submit", saveRecord);
elements.descriptionInput.addEventListener("input", updateDescriptionCount);
elements.searchInput.addEventListener("input", renderRecords);

elements.ratingInput.addEventListener("click", (event) => {
  const button = event.target.closest("[data-rating]");
  if (!button) return;
  const selectedRating = Number(button.dataset.rating);
  pendingRating = pendingRating === selectedRating ? 0 : selectedRating;
  updateRatingInput();
});

elements.quickTags.addEventListener("click", (event) => {
  const button = event.target.closest("[data-tag]");
  if (!button) return;
  if (pendingTags.includes(button.dataset.tag)) removeTag(button.dataset.tag);
  else addTag(button.dataset.tag);
});

elements.selectedTags.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-tag]");
  if (button) removeTag(button.dataset.removeTag);
});

elements.customTagInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== ",") return;
  event.preventDefault();
  addTag(elements.customTagInput.value);
  elements.customTagInput.value = "";
});

elements.imageInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showToast("请选择图片文件");
    return;
  }

  try {
    pendingImage = await resizeImage(file);
    updateImagePreview();
  } catch (error) {
    console.error(error);
    showToast(error.message);
  } finally {
    elements.imageInput.value = "";
  }
});

elements.removeImageButton.addEventListener("click", (event) => {
  event.stopPropagation();
  pendingImage = "";
  updateImagePreview();
});

elements.recordList.addEventListener("click", (event) => {
  const card = event.target.closest("[data-record-id]");
  if (!card) return;
  const record = records.find((item) => item.id === card.dataset.recordId);
  if (record) openDetails(record);
});

elements.recordList.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest("[data-record-id]");
  if (!card) return;
  event.preventDefault();
  const record = records.find((item) => item.id === card.dataset.recordId);
  if (record) openDetails(record);
});

document.querySelector("#editButton").addEventListener("click", () => {
  const record = records.find((item) => item.id === activeRecordId);
  if (!record) return;
  elements.detailDialog.close();
  openEditEditor(record);
});

document.querySelector("#deleteButton").addEventListener("click", deleteActiveRecord);

[elements.editorDialog, elements.detailDialog, elements.dataDialog].forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

window.addEventListener("DOMContentLoaded", async () => {
  try {
    await reloadRecords();
  } catch (error) {
    console.error(error);
    elements.emptyState.hidden = false;
    showToast("本地数据加载失败");
  }

  if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("service-worker.js").catch((error) => console.error(error));
  }
});
