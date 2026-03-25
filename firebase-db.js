// Firestore database module
var DB = (function () {
  "use strict";

  var db = firebase.firestore();
  var unsubscribe = null;

  // Attach real-time listener for user's lists
  function attachListener(uid, onDataChange) {
    detachListener();

    unsubscribe = db
      .collection("users")
      .doc(uid)
      .collection("lists")
      .orderBy("createdAt")
      .onSnapshot(
        function (snapshot) {
          var lists = [];
          snapshot.forEach(function (doc) {
            var data = doc.data();
            lists.push({
              id: doc.id,
              name: data.name,
              createdAt: data.createdAt,
              items: data.items || [],
            });
          });
          onDataChange({ lists: lists });
        },
        function (error) {
          console.error("Firestore listener error:", error);
          if (error.code === "permission-denied") {
            alert("데이터 접근 권한이 없습니다. 다시 로그인해 주세요.");
          }
        }
      );
  }

  function detachListener() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  // Save a single list document
  function saveList(uid, list) {
    var docRef = db
      .collection("users")
      .doc(uid)
      .collection("lists")
      .doc(list.id);
    return docRef.set(
      {
        name: list.name,
        createdAt: list.createdAt,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        items: list.items || [],
      },
      { merge: true }
    ).catch(function (err) {
      console.error("Firestore save error:", err);
      alert("저장에 실패했습니다. 네트워크를 확인해 주세요.");
    });
  }

  // Delete a list document
  function deleteList(uid, listId) {
    return db
      .collection("users")
      .doc(uid)
      .collection("lists")
      .doc(listId)
      .delete()
      .catch(function (err) {
        console.error("Firestore delete error:", err);
        alert("삭제에 실패했습니다. 네트워크를 확인해 주세요.");
      });
  }

  // Migrate localStorage data to Firestore (first login)
  function migrateFromLocal(uid, localData) {
    if (!localData || !localData.lists || localData.lists.length === 0) {
      return Promise.resolve();
    }

    // Check if user already has data in Firestore
    return db
      .collection("users")
      .doc(uid)
      .collection("lists")
      .limit(1)
      .get()
      .then(function (snapshot) {
        if (!snapshot.empty) {
          // User already has Firestore data, skip migration
          return Promise.resolve();
        }

        var batch = db.batch();
        localData.lists.forEach(function (list) {
          var docRef = db
            .collection("users")
            .doc(uid)
            .collection("lists")
            .doc(list.id);
          batch.set(docRef, {
            name: list.name,
            createdAt: list.createdAt,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            items: list.items || [],
          });
        });
        return batch.commit();
      });
  }

  // ---- Token Management ----

  // Generate a random 32-char token
  function _randomToken() {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var result = "";
    for (var i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Create a new API token for the user
  function generateToken(uid) {
    var token = _randomToken();
    var batch = db.batch();

    // Save to user's token subcollection
    var userTokenRef = db.collection("users").doc(uid).collection("tokens").doc();
    batch.set(userTokenRef, {
      token: token,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    // Save to global tokens collection (for fast lookup)
    var globalTokenRef = db.collection("tokens").doc(token);
    batch.set(globalTokenRef, {
      uid: uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    return batch.commit().then(function () {
      return token;
    });
  }

  // Get all tokens for a user
  function getTokens(uid) {
    return db.collection("users").doc(uid).collection("tokens")
      .orderBy("createdAt", "desc")
      .get()
      .then(function (snapshot) {
        var tokens = [];
        snapshot.forEach(function (doc) {
          tokens.push({ id: doc.id, token: doc.data().token, createdAt: doc.data().createdAt });
        });
        return tokens;
      });
  }

  // Delete a token
  function deleteToken(uid, tokenId, tokenValue) {
    var batch = db.batch();
    batch.delete(db.collection("users").doc(uid).collection("tokens").doc(tokenId));
    batch.delete(db.collection("tokens").doc(tokenValue));
    return batch.commit();
  }

  // Find user UID by token
  function findUserByToken(token) {
    return db.collection("tokens").doc(token).get().then(function (doc) {
      if (!doc.exists) return null;
      return doc.data().uid;
    });
  }

  // Add item via token: write to inbox (no auth required)
  function addItemToInbox(token, uid, listName, item) {
    return db.collection("api_inbox").add({
      token: token,
      uid: uid,
      listName: listName,
      item: item,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Process inbox items for logged-in user
  function processInbox(uid) {
    return db.collection("api_inbox")
      .where("uid", "==", uid)
      .get()
      .then(function (snapshot) {
        if (snapshot.empty) return Promise.resolve(0);

        var processed = 0;
        var promises = [];

        snapshot.forEach(function (inboxDoc) {
          var data = inboxDoc.data();
          var promise = _addItemToList(uid, data.listName, data.item)
            .then(function () {
              return inboxDoc.ref.delete();
            })
            .then(function () { processed++; });
          promises.push(promise);
        });

        return Promise.all(promises).then(function () { return processed; });
      });
  }

  // Internal: add item to a user's list
  function _addItemToList(uid, listName, item) {
    return db.collection("users").doc(uid).collection("lists")
      .where("name", "==", listName)
      .limit(1)
      .get()
      .then(function (snapshot) {
        if (!snapshot.empty) {
          var doc = snapshot.docs[0];
          var items = doc.data().items || [];
          items.push(item);
          return doc.ref.update({
            items: items,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        } else {
          var newListId = Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
          var d = new Date();
          var createdAt = d.getFullYear() + "-" +
            String(d.getMonth() + 1).padStart(2, "0") + "-" +
            String(d.getDate()).padStart(2, "0");
          return db.collection("users").doc(uid).collection("lists").doc(newListId).set({
            name: listName,
            createdAt: createdAt,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            items: [item],
          });
        }
      });
  }

  return {
    attachListener: attachListener,
    detachListener: detachListener,
    saveList: saveList,
    deleteList: deleteList,
    migrateFromLocal: migrateFromLocal,
    generateToken: generateToken,
    getTokens: getTokens,
    deleteToken: deleteToken,
    findUserByToken: findUserByToken,
    addItemToInbox: addItemToInbox,
    processInbox: processInbox,
  };
})();
