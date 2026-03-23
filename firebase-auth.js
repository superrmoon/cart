// Authentication module using Google Identity Services (GIS)
var Auth = (function () {
  "use strict";

  var auth = firebase.auth();
  var GOOGLE_CLIENT_ID = "421516237009-0pv522qit1rukoagtorrqv7nce0lc7l3.apps.googleusercontent.com";
  var _authCallback = null;

  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

  function signIn() {
    if (typeof google === "undefined" || !google.accounts) {
      console.error("Google Identity Services not loaded");
      return;
    }

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: function (response) {
        // Use Google ID token to sign into Firebase
        var credential = firebase.auth.GoogleAuthProvider.credential(response.credential);
        auth.signInWithCredential(credential).catch(function (err) {
          console.error("Firebase sign-in error:", err);
        });
      },
    });

    // Show Google One Tap or account chooser
    google.accounts.id.prompt(function (notification) {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // One Tap not available, use button flow
        _showGooglePopup();
      }
    });
  }

  function _showGooglePopup() {
    // Fallback: open Google OAuth in popup manually
    var width = 450;
    var height = 600;
    var left = (screen.width - width) / 2;
    var top = (screen.height - height) / 2;

    var authUrl = "https://accounts.google.com/o/oauth2/v2/auth" +
      "?client_id=" + encodeURIComponent(GOOGLE_CLIENT_ID) +
      "&redirect_uri=" + encodeURIComponent(window.location.origin + window.location.pathname) +
      "&response_type=token" +
      "&scope=openid%20email%20profile" +
      "&prompt=select_account";

    var popup = window.open(authUrl, "googleAuth",
      "width=" + width + ",height=" + height + ",left=" + left + ",top=" + top);

    // Listen for redirect back with token
    var timer = setInterval(function () {
      try {
        if (!popup || popup.closed) {
          clearInterval(timer);
          return;
        }
        if (popup.location.href.includes("access_token")) {
          var hash = popup.location.hash.substring(1);
          var params = new URLSearchParams(hash);
          var accessToken = params.get("access_token");
          popup.close();
          clearInterval(timer);

          if (accessToken) {
            var credential = firebase.auth.GoogleAuthProvider.credential(null, accessToken);
            auth.signInWithCredential(credential).catch(function (err) {
              console.error("Firebase sign-in error:", err);
            });
          }
        }
      } catch (e) {
        // Cross-origin error - popup still on Google domain, keep waiting
      }
    }, 500);
  }

  function signOut() {
    return auth.signOut();
  }

  function onAuthChanged(callback) {
    _authCallback = callback;
    auth.onAuthStateChanged(callback);
  }

  function getCurrentUser() {
    return auth.currentUser;
  }

  return { signIn: signIn, signOut: signOut, onAuthChanged: onAuthChanged, getCurrentUser: getCurrentUser };
})();
