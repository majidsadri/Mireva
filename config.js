// API Configuration for Mireva App
export const API_CONFIG = {
  BASE_URL: 'https://51e3-18-215-164-114.ngrok-free.app',
  ENDPOINTS: {
    SIGNIN: '/signin',
    SIGNUP: '/signup',
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
    UPDATE_ACCOUNT: '/update-account'
  },
  // Default headers for all API calls
  getHeaders: () => ({
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  }),
};

export default API_CONFIG;