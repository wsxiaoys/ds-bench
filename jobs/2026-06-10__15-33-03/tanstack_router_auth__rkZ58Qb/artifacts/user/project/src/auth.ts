// Simple auth store - module-level state accessible both in React and route guards
export const auth = {
  isAuthenticated: false,
  login() {
    this.isAuthenticated = true
  },
  logout() {
    this.isAuthenticated = false
  },
}