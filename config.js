// API Configuration for Mireva App  
export const API_CONFIG = {
  BASE_URL: 'https://mireva.life',
  ENDPOINTS: {
    SIGNIN: '/signin',
    SIGNUP: '/signup',
    GOOGLE_AUTH: '/google-auth',
    BIOMETRIC_SIGNIN: '/biometric-signin',
    PANTRY: '/pantry',
    RECOMMEND: '/recommend',
    PROFILE: '/profile',
    SCAN_AND_ADD: '/scan-and-add',
    SHOPPING_LIST: '/shopping/list',
    SHOPPING_SUGGESTIONS: '/shopping/suggestions',
    GET_AVAILABLE_PANTRIES: '/get-available-pantries',
    LOG_RECIPE: '/log-recipe',
    GET_RECIPE_LOGS: '/get-recipe-logs',
    SEARCH_RECIPES: '/search-recipes',
    UPDATE_ACCOUNT: '/update-account',
    UPDATE_PASSWORD: '/update-password',
    REQUEST_PANTRY_JOIN: '/request-pantry-join',
    GET_PANTRY_REQUESTS: '/get-pantry-requests',
    RESPOND_PANTRY_REQUEST: '/respond-pantry-request',
    GET_USER_REQUESTS: '/get-user-requests',
    GET_PANTRY_OWNERSHIP: '/get-pantry-ownership',
    SET_PANTRY_OWNER: '/set-pantry-owner'
  },
  // Default headers for all API calls
  getHeaders: () => ({
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  }),
};

export default API_CONFIG;