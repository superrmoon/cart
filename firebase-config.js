// Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyDecbJTIcx_BYFWCeyYdxokZUAigcjfu4I",
  authDomain: "cart-f42c2.firebaseapp.com",
  projectId: "cart-f42c2",
  storageBucket: "cart-f42c2.firebasestorage.app",
  messagingSenderId: "421516237009",
  appId: "1:421516237009:web:e50ec4b7cdf1e2037a0df0",
};

firebase.initializeApp(firebaseConfig);

// Enable Firestore offline persistence
firebase
  .firestore()
  .enablePersistence({ synchronizeTabs: true })
  .catch(function (err) {
    if (err.code === "failed-precondition") {
      console.warn("Firestore persistence failed: multiple tabs open");
    } else if (err.code === "unimplemented") {
      console.warn("Firestore persistence not supported");
    }
  });
