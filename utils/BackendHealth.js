import { API_CONFIG } from '../config';

class BackendHealth {
  constructor() {
    this.isOnline = false;
    this.lastChecked = null;
  }

  async checkHealth() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`${API_CONFIG.BASE_URL}/list_routes`, {
        method: 'GET',
        signal: controller.signal,
        headers: API_CONFIG.getHeaders(),
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        this.isOnline = true;
        this.lastChecked = new Date();
        return { 
          online: true, 
          status: '🟢 Backend online and responding',
          message: 'All authentication features available'
        };
      } else {
        this.isOnline = false;
        return { 
          online: false, 
          status: '🟡 Backend responding but has issues',
          message: `HTTP ${response.status} - ${response.statusText}`
        };
      }
    } catch (error) {
      this.isOnline = false;
      this.lastChecked = new Date();

      if (error.name === 'AbortError') {
        return { 
          online: false, 
          status: '🔴 Backend connection timeout',
          message: 'Server not responding within 5 seconds'
        };
      }

      return { 
        online: false, 
        status: '🔴 Backend offline',
        message: 'Cannot connect to EC2 server'
      };
    }
  }

  async testSignup(email, password) {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SIGNUP}`, {
        method: 'POST',
        headers: API_CONFIG.getHeaders(),
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, data };
      } else {
        return { success: false, error: data.error || 'Signup failed' };
      }
    } catch (error) {
      return { 
        success: false, 
        error: 'Network error - backend not reachable',
        details: error.message
      };
    }
  }

  async testSignin(email, password) {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SIGNIN}`, {
        method: 'POST',
        headers: API_CONFIG.getHeaders(),
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, data };
      } else {
        return { success: false, error: data.error || 'Signin failed' };
      }
    } catch (error) {
      return { 
        success: false, 
        error: 'Network error - backend not reachable',
        details: error.message
      };
    }
  }

  getInstructions() {
    return {
      title: 'Backend Setup Instructions',
      steps: [
        '1. SSH to EC2 server:',
        '   ssh -i ~/.ssh/id_rsa ubuntu@18.215.164.114',
        '',
        '2. Navigate to backend directory:',
        '   cd /mnt/data/MirevaApp/backend',
        '',
        '3. Fix users.json permissions:',
        '   chmod 666 ../users.json',
        '',
        '4. Start the backend server:',
        '   ./run.sh',
        '',
        '5. Verify server is running:',
        '   curl http://localhost:5001/list_routes',
        '',
        '6. Check if port 5001 is accessible externally',
      ]
    };
  }
}

export default new BackendHealth();