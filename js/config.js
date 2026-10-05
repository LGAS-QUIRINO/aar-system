// Fill these two after deploying (see SETUP guide). Leave API_URL empty to run in Demo Mode.
export const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbzF7Y4wZ_NCrelHiJCEBoy8AYPPYA-BxvC5O6O2wnV9Kk2mHVABmP6D29wx6GHrO_-T/exec',
  CLIENT_ID: '39292565740-2p9gnuhhpd48ugcmhb70md22of696e3g.apps.googleusercontent.com',
  SYNC_EVERY_MS: 60000,
  // true only on the practice (test) copy: shows Admin › Clear Test Data. The live copy sets this to false.
  PRACTICE: true
};
export const DEMO = !CONFIG.API_URL;
