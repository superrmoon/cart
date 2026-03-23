// Authentication module - Direct OAuth redirect flow
var Auth = (function () {
  "use strict";

  var auth = firebase.auth();
  var GOOGLE_CLIENT_ID = "421516237009-0pv522qit1rukoagtorrqv7nce0lc7l3.apps.googleusercontent.com";
  var REDIRECT_URI = window.location.origin + window.location.pathname;

  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

  // Check if page loaded with OAuth token in URL hash (redirect callback)
  function _handleRedirectCallback() {
    var hash = window.location.hash;
    if (!hash || !hash.includes("access_token")) return;

    var params = new URLSearchParams(hash.substring(1));
    var accessToken = params.get("access_token");

    // Clean URL hash
    history.replaceState(null, "", window.location.pathname);

    if (accessToken) {
      var credential = firebase.auth.GoogleAuthProvider.credential(null, accessToken);
      auth.signInWithCredential(credential).catch(function (err) {
        console.error("Firebase sign-in error:", err);
      });
    }
  }

  // Run on page load
  _handleRedirectCallback();

  function signIn() {
    // Direct redirect to Google OAuth (works on all browsers including iOS Safari)
    var authUrl = "https://accounts.google.com/o/oauth2/v2/auth" +
      "?client_id=" + encodeURIComponent(GOOGLE_CLIENT_ID) +
      "&redirect_uri=" + encodeURIComponent(REDIRECT_URI) +
      "&response_type=token" +
      "&scope=openid%20email%20profile" +
      "&prompt=select_account";

    window.location.href = authUrl;
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
