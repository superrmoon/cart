// Authentication module
var Auth = (function () {
  "use strict";

  var auth = firebase.auth();
  var provider = new firebase.auth.GoogleAuthProvider();

  // Ensure auth state persists across sessions
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

  // Handle redirect result (for mobile sign-in)
  auth.getRedirectResult().catch(function (err) {
    console.error("Redirect result error:", err);
  });

  function signIn() {
    // Check if running as standalone PWA (home screen app)
    var isStandalone = window.navigator.standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;

    if (isStandalone) {
      // Standalone PWA: use popup (redirect won't return to PWA)
      return auth.signInWithPopup(provider).catch(function (err) {
        // If popup blocked, fall back to redirect
        if (err.code === "auth/popup-blocked" || err.code === "auth/popup-closed-by-user") {
          return auth.signInWithRedirect(provider);
        }
        console.error("Sign in error:", err);
      });
    }

    // Mobile browser: redirect, Desktop: popup
    if (/iPhone|iPad|Android/i.test(navigator.userAgent)) {
      return auth.signInWithRedirect(provider);
    }
    return auth.signInWithPopup(provider);
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
