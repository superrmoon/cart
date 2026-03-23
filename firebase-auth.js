// Authentication module - Direct OAuth redirect flow
var Auth = (function () {
  "use strict";

  var auth = firebase.auth();
  var GOOGLE_CLIENT_ID = "421516237009-0pv522qit1rukoagtorrqv7nce0lc7l3.apps.googleusercontent.com";
  var REDIRECT_URI = "https://superrmoon.github.io/cart/";

  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

  // Check if page loaded with OAuth token in URL hash (redirect callback)
  function _handleRedirectCallback() {
    var hash = window.location.hash;
    if (!hash || !hash.includes("access_token")) return;

    var params = new URLSearchParams(hash.substring(1));
    var accessToken = params.get("access_token");

    // Verify state parameter (CSRF protection)
    var returnedState = params.get("state");
    var savedState = sessionStorage.getItem("oauth_state");
    sessionStorage.removeItem("oauth_state");

    if (!returnedState || returnedState !== savedState) {
      console.error("OAuth state mismatch - possible CSRF attack");
      history.replaceState(null, "", window.location.pathname);
      return;
    }

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
    // Generate random state for CSRF protection
    var state = Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem("oauth_state", state);

    var authUrl = "https://accounts.google.com/o/oauth2/v2/auth" +
      "?client_id=" + encodeURIComponent(GOOGLE_CLIENT_ID) +
      "&redirect_uri=" + encodeURIComponent(REDIRECT_URI) +
      "&response_type=token" +
      "&scope=openid%20email%20profile" +
      "&prompt=select_account" +
      "&state=" + encodeURIComponent(state);

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
