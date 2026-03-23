// Authentication module
var Auth = (function () {
  "use strict";

  var auth = firebase.auth();
  var provider = new firebase.auth.GoogleAuthProvider();

  // Ensure auth state persists across sessions
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

  function signIn() {
    // Always use popup - redirect has issues with Safari ITP
    return auth.signInWithPopup(provider).catch(function (err) {
      console.error("Sign in error:", err.code, err.message);
    });
  }

  function signOut() {
    return auth.signOut();
  }

  function onAuthChanged(callback) {
    auth.onAuthStateChanged(callback);
  }

  function getCurrentUser() {
    return auth.currentUser;
  }

  return { signIn: signIn, signOut: signOut, onAuthChanged: onAuthChanged, getCurrentUser: getCurrentUser };
})();
