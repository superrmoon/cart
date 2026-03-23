// ============================================================
// Cart PWA - App Logic
// ============================================================

(function () {
  "use strict";

  // ---- Storage ----
  var STORAGE_KEY = "shopping-list-data";

  function loadData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { lists: [] };
    } catch (e) {
      return { lists: [] };
    }
  }

  function saveLocal(d) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  }

  // Save list to Firestore (logged in) or localStorage (logged out)
  function saveListChange(listId) {
    var user = Auth.getCurrentUser();
    if (user) {
      var list = getList(listId);
      if (list) {
        DB.saveList(user.uid, list);
      }
      // Don't renderLists here - onSnapshot will handle it
    } else {
      saveLocal(data);
      renderLists();
      if (currentListId) renderItems();
    }
  }

  function saveItemChange() {
    var user = Auth.getCurrentUser();
    if (user && currentListId) {
      var list = getList(currentListId);
      if (list) {
        DB.saveList(user.uid, list);
      }
      // Don't renderItems here - onSnapshot will handle it
    } else {
      saveLocal(data);
      if (currentListId) renderItems();
    }
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
    var d = new Date(dateStr + "T00:00:00");
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return m + "-" + day;
  }

  function todayStr() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  // ---- State ----
  var data = loadData();
  var currentListId = null;
  var editingListId = null;
  var editingItemId = null;
  var confirmCallback = null;
  var isLoggedIn = false;
  var isSaving = false;

  // ---- DOM ----
  var $ = function (sel) { return document.querySelector(sel); };

  var listView = $("#list-view");
  var itemView = $("#item-view");
  var listsContainer = $("#lists-container");
  var itemsContainer = $("#items-container");
  var emptyLists = $("#empty-lists");
  var emptyItems = $("#empty-items");
  var totalAmountEl = $("#total-amount");
  var hideCompletedCb = $("#hide-completed");
  var itemViewTitle = $("#item-view-title");

  // Auth UI
  var authBtn = $("#auth-btn");
  var authText = $("#auth-text");
  var authPhoto = $("#auth-photo");

  // Modals
  var listModal = $("#list-modal");
  var listModalTitle = $("#list-modal-title");
  var listNameInput = $("#list-name-input");
  var itemModal = $("#item-modal");
  var itemModalTitle = $("#item-modal-title");
  var itemNameInput = $("#item-name-input");
  var itemDateInput = $("#item-date-input");
  var itemAmountInput = $("#item-amount-input");
  var confirmModal = $("#confirm-modal");
  var confirmMessage = $("#confirm-message");

  // ---- Helpers ----
  function getList(id) {
    return data.lists.find(function (l) { return l.id === id; });
  }

  function listTotal(list) {
    return list.items
      .filter(function (item) { return !item.completed; })
      .reduce(function (sum, item) { return sum + (Number(item.amount) || 0); }, 0);
  }

  // ---- Views ----
  function showView(view) {
    listView.classList.remove("active");
    itemView.classList.remove("active");
    view.classList.add("active");
  }

  // ---- Auth UI ----
  function updateAuthUI(user) {
    if (user) {
      isLoggedIn = true;
      authText.style.display = "none";
      authPhoto.src = user.photoURL || "";
      authPhoto.style.display = user.photoURL ? "block" : "none";
      if (!user.photoURL) {
        authText.textContent = user.displayName ? user.displayName.charAt(0) : "?";
        authText.style.display = "block";
        authText.classList.add("auth-initial");
      }
    } else {
      isLoggedIn = false;
      authText.textContent = "로그인";
      authText.style.display = "block";
      authText.classList.remove("auth-initial");
      authPhoto.style.display = "none";
    }
  }

  // ---- Render Lists ----
  function renderLists() {
    listsContainer.innerHTML = "";

    if (data.lists.length === 0) {
      emptyLists.style.display = "block";
      return;
    }
    emptyLists.style.display = "none";

    data.lists.forEach(function (list) {
      var li = document.createElement("li");
      li.className = "list-item";

      var total = listTotal(list);
      var activeCount = list.items.filter(function (i) { return !i.completed; }).length;
      var totalCount = list.items.length;

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

      li.addEventListener("click", function (e) {
        if (e.target.closest(".list-item-actions")) return;
        openList(list.id);
      });

      listsContainer.appendChild(li);
    });

    listsContainer.querySelectorAll(".btn-edit-list").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        openEditListModal(btn.dataset.id);
      });
    });

    listsContainer.querySelectorAll(".btn-delete-list").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        deleteList(btn.dataset.id);
      });
    });
  }

  // ---- Render Items ----
  function renderItems() {
    var list = getList(currentListId);
    if (!list) return;

    itemViewTitle.textContent = list.name;
    itemsContainer.innerHTML = "";

    var hideCompleted = hideCompletedCb.checked;
    var visibleItems = hideCompleted
      ? list.items.filter(function (i) { return !i.completed; })
      : list.items;

    var total = listTotal(list);
    totalAmountEl.textContent = formatAmount(total);

    if (visibleItems.length === 0) {
      emptyItems.style.display = "block";
      return;
    }
    emptyItems.style.display = "none";

    visibleItems.forEach(function (item) {
      var li = document.createElement("li");
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

    itemsContainer.querySelectorAll(".shop-item-checkbox").forEach(function (cb) {
      cb.addEventListener("change", function () {
        toggleItem(cb.dataset.id);
      });
    });

    itemsContainer.querySelectorAll(".btn-edit-item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openEditItemModal(btn.dataset.id);
      });
    });

    itemsContainer.querySelectorAll(".btn-delete-item").forEach(function (btn) {
      btn.addEventListener("click", function () {
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
    var list = getList(id);
    if (!list) return;
    editingListId = id;
    listModalTitle.textContent = "목록 수정";
    listNameInput.value = list.name;
    openModal(listModal);
    listNameInput.focus();
  }

  function deleteList(id) {
    var list = getList(id);
    if (!list) return;
    showConfirm("'" + list.name + "' 목록을 삭제하시겠습니까?", function () {
      var user = Auth.getCurrentUser();
      if (user) {
        // Firestore delete - onSnapshot will update UI
        DB.deleteList(user.uid, id);
      } else {
        data.lists = data.lists.filter(function (l) { return l.id !== id; });
        saveLocal(data);
        renderLists();
      }
    });
  }

  // ---- Item Actions ----
  function toggleItem(id) {
    var list = getList(currentListId);
    if (!list) return;
    var item = list.items.find(function (i) { return i.id === id; });
    if (!item) return;
    item.completed = !item.completed;
    saveItemChange();
  }

  function openEditItemModal(id) {
    var list = getList(currentListId);
    if (!list) return;
    var item = list.items.find(function (i) { return i.id === id; });
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
    showConfirm("이 품목을 삭제하시겠습니까?", function () {
      var list = getList(currentListId);
      if (!list) return;
      list.items = list.items.filter(function (i) { return i.id !== id; });
      saveItemChange();
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
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ============================================================
  // Event Listeners
  // ============================================================

  // Auth button
  authBtn.addEventListener("click", function () {
    if (isLoggedIn) {
      showConfirm("로그아웃 하시겠습니까?", function () {
        Auth.signOut();
      });
    } else {
      Auth.signIn();
    }
  });

  // Add list button
  $("#add-list-btn").addEventListener("click", function () {
    editingListId = null;
    listModalTitle.textContent = "새 목록";
    listNameInput.value = "";
    openModal(listModal);
    listNameInput.focus();
  });

  // Save list
  var listSaveBtn = $("#list-modal-save");
  listSaveBtn.addEventListener("click", function () {
    if (isSaving) return;
    var name = listNameInput.value.trim();
    if (!name) return;
    isSaving = true;
    listSaveBtn.disabled = true;

    var user = Auth.getCurrentUser();

    if (editingListId) {
      var list = getList(editingListId);
      if (list) list.name = name;

      if (user) {
        DB.saveList(user.uid, list);
      } else {
        saveLocal(data);
        renderLists();
      }
    } else {
      var newList = {
        id: uuid(),
        name: name,
        createdAt: todayStr(),
        items: [],
      };

      if (user) {
        DB.saveList(user.uid, newList);
      } else {
        data.lists.push(newList);
        saveLocal(data);
        renderLists();
      }
    }

    closeModal(listModal);
    editingListId = null;
    listSaveBtn.disabled = false;
    isSaving = false;
  });

  // Cancel list modal
  $("#list-modal-cancel").addEventListener("click", function () {
    closeModal(listModal);
    editingListId = null;
  });

  // Back button
  $("#back-btn").addEventListener("click", function () {
    currentListId = null;
    showView(listView);
    renderLists();
  });

  // Add item button
  $("#add-item-btn").addEventListener("click", function () {
    editingItemId = null;
    itemModalTitle.textContent = "품목 추가";
    itemNameInput.value = "";
    itemDateInput.value = todayStr();
    itemAmountInput.value = "";
    openModal(itemModal);
    itemNameInput.focus();
  });

  // Save item
  var itemSaveBtn = $("#item-modal-save");
  itemSaveBtn.addEventListener("click", function () {
    if (isSaving) return;
    var name = itemNameInput.value.trim();
    var date = itemDateInput.value;
    var amount = Math.max(0, Math.floor(Number(itemAmountInput.value) || 0));
    if (!name) return;
    if (!isFinite(amount)) amount = 0;
    isSaving = true;
    itemSaveBtn.disabled = true;

    var list = getList(currentListId);
    if (!list) { isSaving = false; itemSaveBtn.disabled = false; return; }

    if (editingItemId) {
      var item = list.items.find(function (i) { return i.id === editingItemId; });
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

    saveItemChange();
    closeModal(itemModal);
    editingItemId = null;
    itemSaveBtn.disabled = false;
    isSaving = false;
  });

  // Cancel item modal
  $("#item-modal-cancel").addEventListener("click", function () {
    closeModal(itemModal);
    editingItemId = null;
  });

  // Confirm OK
  $("#confirm-ok").addEventListener("click", function () {
    closeModal(confirmModal);
    if (confirmCallback) {
      confirmCallback();
      confirmCallback = null;
    }
  });

  // Confirm Cancel
  $("#confirm-cancel").addEventListener("click", function () {
    closeModal(confirmModal);
    confirmCallback = null;
  });

  // Hide completed toggle
  hideCompletedCb.addEventListener("change", function () {
    renderItems();
  });

  // Close modals on backdrop click
  [listModal, itemModal, confirmModal].forEach(function (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === modal) {
        closeModal(modal);
        editingListId = null;
        editingItemId = null;
        confirmCallback = null;
      }
    });
  });

  // Enter key in modals
  listNameInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") $("#list-modal-save").click();
  });

  itemAmountInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") $("#item-modal-save").click();
  });

  // ============================================================
  // Firebase Auth State Listener
  // ============================================================
  Auth.onAuthChanged(function (user) {
    updateAuthUI(user);

    if (user) {
      // Migrate localStorage data to Firestore on first login
      var localData = loadData();
      if (localData.lists.length > 0) {
        DB.migrateFromLocal(user.uid, localData);
      }

      // Attach real-time Firestore listener
      DB.attachListener(user.uid, function (remoteData) {
        data = remoteData;
        saveLocal(data);
        renderLists();
        if (currentListId) renderItems();
      });
    } else {
      DB.detachListener();
      data = loadData();
      renderLists();
    }
  });

  // ---- Register Service Worker ----
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }

  // ---- Init ----
  renderLists();
})();
