// Simple network test
const API_URL = "https://37c2-18-215-164-114.ngrok-free.app";

console.log('🔥 Testing network connection...');
console.log('🔥 API_URL:', API_URL);

fetch(`${API_URL}/list_routes`, {
  method: 'GET',
  headers: {
    'ngrok-skip-browser-warning': 'true'
  }
})
.then(response => {
  console.log('🔥 Response status:', response.status);
  return response.json();
})
.then(data => {
  console.log('🔥 SUCCESS! Routes found:', data.length);
})
.catch(error => {
  console.log('🔥 NETWORK ERROR:', error);
});

// Test signup
setTimeout(() => {
  console.log('🔥 Testing signup endpoint...');
  fetch(`${API_URL}/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    },
    body: JSON.stringify({
      email: 'jstest@example.com',
      password: 'test123'
    })
  })
  .then(response => {
    console.log('🔥 Signup response status:', response.status);
    return response.json();
  })
  .then(data => {
    console.log('🔥 Signup response data:', data);
  })
  .catch(error => {
    console.log('🔥 Signup error:', error);
  });
}, 2000);