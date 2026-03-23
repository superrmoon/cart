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
    );
  }

  // Delete a list document
  function deleteList(uid, listId) {
    return db
      .collection("users")
      .doc(uid)
      .collection("lists")
      .doc(listId)
      .delete();
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

  return {
    attachListener: attachListener,
    detachListener: detachListener,
    saveList: saveList,
    deleteList: deleteList,
    migrateFromLocal: migrateFromLocal,
  };
})();
