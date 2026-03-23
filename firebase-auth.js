// Authentication module
var Auth = (function () {
  "use strict";

  var auth = firebase.auth();
  var provider = new firebase.auth.GoogleAuthProvider();

  // Ensure auth state persists in IndexedDB (works with Safari ITP)
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

  function signIn() {
    // Mobile: always use redirect (popup opens new tab on iOS, breaks auth flow)
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      return auth.signInWithRedirect(provider);
    }
    // Desktop: popup
    return auth.signInWithPopup(provider);
  }

  function signOut() {
    return auth.signOut();
  }

  function onAuthChanged(callback) {
    // First check redirect result, then listen for auth state changes
    auth.getRedirectResult().then(function (result) {
      // Redirect sign-in completed successfully
      if (result && result.user) {
        callback(result.user);
      }
    }).catch(function (err) {
      if (err.code !== "auth/credential-already-in-use") {
        console.error("Redirect auth error:", err.code);
      }
    });

    // Also listen for auth state changes (handles persistent login)
    auth.onAuthStateChanged(callback);
  }

  function getCurrentUser() {
    return auth.currentUser;
  }

  return { signIn: signIn, signOut: signOut, onAuthChanged: onAuthChanged, getCurrentUser: getCurrentUser };
})();
