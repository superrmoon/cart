// Authentication module
var Auth = (function () {
  "use strict";

  var auth = firebase.auth();
  var provider = new firebase.auth.GoogleAuthProvider();

  function signIn() {
    // Mobile: redirect (popup blocked in PWA), Desktop: popup
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
