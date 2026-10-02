// Fill these two after deploying (see SETUP guide). Leave API_URL empty to run in Demo Mode.
export const CONFIG = {
  API_URL: '',     // Apps Script web app URL, ends with /exec
  CLIENT_ID: '',   // Google OAuth Client ID, ends with .apps.googleusercontent.com
  SYNC_EVERY_MS: 60000
};
export const DEMO = !CONFIG.API_URL;
