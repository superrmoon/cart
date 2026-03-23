// ============================================================
// Shopping List PWA - App Logic
// ============================================================

(function () {
  "use strict";

  // ---- Storage ----
  const STORAGE_KEY = "shopping-list-data";

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { lists: [] };
    } catch {
      return { lists: [] };
    }
  }

  function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  // ---- UUID ----
  function uuid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  // ---- Format ----
  function formatAmount(n) {
    return Number(n).toLocaleString("ko-KR") + "원";
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return m + "-" + day;
  }

  function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  // ---- State ----
  let data = loadData();
  let currentListId = null;
  let editingListId = null;
  let editingItemId = null;
  let confirmCallback = null;

  // ---- DOM ----
  const $ = (sel) => document.querySelector(sel);

  const listView = $("#list-view");
  const itemView = $("#item-view");
  const listsContainer = $("#lists-container");
  const itemsContainer = $("#items-container");
  const emptyLists = $("#empty-lists");
  const emptyItems = $("#empty-items");
  const totalAmountEl = $("#total-amount");
  const hideCompletedCb = $("#hide-completed");
  const itemViewTitle = $("#item-view-title");

  // Modals
  const listModal = $("#list-modal");
  const listModalTitle = $("#list-modal-title");
  const listNameInput = $("#list-name-input");
  const itemModal = $("#item-modal");
  const itemModalTitle = $("#item-modal-title");
  const itemNameInput = $("#item-name-input");
  const itemDateInput = $("#item-date-input");
  const itemAmountInput = $("#item-amount-input");
  const confirmModal = $("#confirm-modal");
  const confirmMessage = $("#confirm-message");

  // ---- Helpers ----
  function getList(id) {
    return data.lists.find((l) => l.id === id);
  }

  function listTotal(list) {
    return list.items
      .filter((item) => !item.completed)
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }

  // ---- Views ----
  function showView(view) {
    listView.classList.remove("active");
    itemView.classList.remove("active");
    view.classList.add("active");
  }

  // ---- Render Lists ----
  function renderLists() {
    listsContainer.innerHTML = "";

    if (data.lists.length === 0) {
      emptyLists.style.display = "block";
      return;
    }
    emptyLists.style.display = "none";

    data.lists.forEach((list) => {
      const li = document.createElement("li");
      li.className = "list-item";

      const total = listTotal(list);
      const activeCount = list.items.filter((i) => !i.completed).length;
      const totalCount = list.items.length;

      li.innerHTML =
        '<div class="list-item-info">' +
        '<div class="list-item-name">' + escapeHtml(list.name) + "</div>" +
        '<div class="list-item-count">' + activeCount + " / " + totalCount + " 품목</div>" +
        "</div>" +
        '<div class="list-item-amount">' + formatAmount(total) + "</div>" +
        '<div class="list-item-actions">' +
        '<button class="btn-small btn-edit-list" data-id="' + list.id + '">&#9998;</button>' +
        '<button class="btn-small btn-delete-list" data-id="' + list.id + '">&#10005;</button>' +
        "</div>" +
        '<span class="list-item-arrow">&rsaquo;</span>';

      // Tap on list item (not buttons) -> open items
      li.addEventListener("click", (e) => {
        if (e.target.closest(".list-item-actions")) return;
        openList(list.id);
      });

      listsContainer.appendChild(li);
    });

    // Edit / Delete buttons
    listsContainer.querySelectorAll(".btn-edit-list").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openEditListModal(btn.dataset.id);
      });
    });

    listsContainer.querySelectorAll(".btn-delete-list").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteList(btn.dataset.id);
      });
    });
  }

  // ---- Render Items ----
  function renderItems() {
    const list = getList(currentListId);
    if (!list) return;

    itemViewTitle.textContent = list.name;
    itemsContainer.innerHTML = "";

    const hideCompleted = hideCompletedCb.checked;
    const visibleItems = hideCompleted
      ? list.items.filter((i) => !i.completed)
      : list.items;

    const total = listTotal(list);
    totalAmountEl.textContent = formatAmount(total);

    if (visibleItems.length === 0) {
      emptyItems.style.display = "block";
      return;
    }
    emptyItems.style.display = "none";

    visibleItems.forEach((item) => {
      const li = document.createElement("li");
      li.className = "shop-item" + (item.completed ? " completed" : "");

      li.innerHTML =
        '<input type="checkbox" class="shop-item-checkbox" ' +
        (item.completed ? "checked" : "") +
        ' data-id="' + item.id + '">' +
        '<div class="shop-item-info">' +
        '<div class="shop-item-name">' + escapeHtml(item.name) + "</div>" +
        '<div class="shop-item-date">' + formatDate(item.date) + "</div>" +
        "</div>" +
        '<div class="shop-item-amount">' + formatAmount(item.amount) + "</div>" +
        '<div class="shop-item-actions">' +
        '<button class="btn-small btn-edit-item" data-id="' + item.id + '">&#9998;</button>' +
        '<button class="btn-small btn-delete-item" data-id="' + item.id + '">&#10005;</button>' +
        "</div>";

      itemsContainer.appendChild(li);
    });

    // Checkbox
    itemsContainer.querySelectorAll(".shop-item-checkbox").forEach((cb) => {
      cb.addEventListener("change", () => {
        toggleItem(cb.dataset.id);
      });
    });

    // Edit
    itemsContainer.querySelectorAll(".btn-edit-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        openEditItemModal(btn.dataset.id);
      });
    });

    // Delete
    itemsContainer.querySelectorAll(".btn-delete-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        deleteItem(btn.dataset.id);
      });
    });
  }

  // ---- List Actions ----
  function openList(id) {
    currentListId = id;
    showView(itemView);
    renderItems();
  }

  function openEditListModal(id) {
    const list = getList(id);
    if (!list) return;
    editingListId = id;
    listModalTitle.textContent = "목록 수정";
    listNameInput.value = list.name;
    openModal(listModal);
    listNameInput.focus();
  }

  function deleteList(id) {
    const list = getList(id);
    if (!list) return;
    showConfirm("'" + list.name + "' 목록을 삭제하시겠습니까?", () => {
      data.lists = data.lists.filter((l) => l.id !== id);
      saveData(data);
      renderLists();
    });
  }

  // ---- Item Actions ----
  function toggleItem(id) {
    const list = getList(currentListId);
    if (!list) return;
    const item = list.items.find((i) => i.id === id);
    if (!item) return;
    item.completed = !item.completed;
    saveData(data);
    renderItems();
  }

  function openEditItemModal(id) {
    const list = getList(currentListId);
    if (!list) return;
    const item = list.items.find((i) => i.id === id);
    if (!item) return;
    editingItemId = id;
    itemModalTitle.textContent = "품목 수정";
    itemNameInput.value = item.name;
    itemDateInput.value = item.date;
    itemAmountInput.value = item.amount;
    openModal(itemModal);
    itemNameInput.focus();
  }

  function deleteItem(id) {
    showConfirm("이 품목을 삭제하시겠습니까?", () => {
      const list = getList(currentListId);
      if (!list) return;
      list.items = list.items.filter((i) => i.id !== id);
      saveData(data);
      renderItems();
    });
  }

  // ---- Modals ----
  function openModal(modal) {
    modal.classList.add("active");
  }

  function closeModal(modal) {
    modal.classList.remove("active");
  }

  function showConfirm(msg, onOk) {
    confirmMessage.textContent = msg;
    confirmCallback = onOk;
    openModal(confirmModal);
  }

  // ---- Escape HTML ----
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ============================================================
  // Event Listeners
  // ============================================================

  // Add list button
  $("#add-list-btn").addEventListener("click", () => {
    editingListId = null;
    listModalTitle.textContent = "새 목록";
    listNameInput.value = "";
    openModal(listModal);
    listNameInput.focus();
  });

  // Save list
  $("#list-modal-save").addEventListener("click", () => {
    const name = listNameInput.value.trim();
    if (!name) return;

    if (editingListId) {
      const list = getList(editingListId);
      if (list) list.name = name;
    } else {
      data.lists.push({
        id: uuid(),
        name: name,
        createdAt: todayStr(),
        items: [],
      });
    }
    saveData(data);
    closeModal(listModal);
    editingListId = null;
    renderLists();
  });

  // Cancel list modal
  $("#list-modal-cancel").addEventListener("click", () => {
    closeModal(listModal);
    editingListId = null;
  });

  // Back button
  $("#back-btn").addEventListener("click", () => {
    currentListId = null;
    showView(listView);
    renderLists();
  });

  // Add item button
  $("#add-item-btn").addEventListener("click", () => {
    editingItemId = null;
    itemModalTitle.textContent = "품목 추가";
    itemNameInput.value = "";
    itemDateInput.value = todayStr();
    itemAmountInput.value = "";
    openModal(itemModal);
    itemNameInput.focus();
  });

  // Save item
  $("#item-modal-save").addEventListener("click", () => {
    const name = itemNameInput.value.trim();
    const date = itemDateInput.value;
    const amount = Number(itemAmountInput.value) || 0;
    if (!name) return;

    const list = getList(currentListId);
    if (!list) return;

    if (editingItemId) {
      const item = list.items.find((i) => i.id === editingItemId);
      if (item) {
        item.name = name;
        item.date = date;
        item.amount = amount;
      }
    } else {
      list.items.push({
        id: uuid(),
        name: name,
        date: date,
        amount: amount,
        completed: false,
      });
    }
    saveData(data);
    closeModal(itemModal);
    editingItemId = null;
    renderItems();
  });

  // Cancel item modal
  $("#item-modal-cancel").addEventListener("click", () => {
    closeModal(itemModal);
    editingItemId = null;
  });

  // Confirm OK
  $("#confirm-ok").addEventListener("click", () => {
    closeModal(confirmModal);
    if (confirmCallback) {
      confirmCallback();
      confirmCallback = null;
    }
  });

  // Confirm Cancel
  $("#confirm-cancel").addEventListener("click", () => {
    closeModal(confirmModal);
    confirmCallback = null;
  });

  // Hide completed toggle
  hideCompletedCb.addEventListener("change", () => {
    renderItems();
  });

  // Close modals on backdrop click
  [listModal, itemModal, confirmModal].forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeModal(modal);
        editingListId = null;
        editingItemId = null;
        confirmCallback = null;
      }
    });
  });

  // Enter key in modals
  listNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("#list-modal-save").click();
  });

  itemAmountInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("#item-modal-save").click();
  });

  // ---- Register Service Worker ----
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  // ---- Init ----
  renderLists();
})();
