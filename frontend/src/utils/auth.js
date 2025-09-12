/**
 * Helper function to get authenticated user information
 * and token in a consistent way across the application
 */
export const getAuth = async () => {
  // Get Firebase auth if available
  const firebaseAuth = window.firebase?.auth?.();
  const currentUser = firebaseAuth?.currentUser;
  
  let token = '';
  if (currentUser) {
    try {
      token = await currentUser.getIdToken();
    } catch (error) {
      console.error('Error getting auth token:', error);
    }
  }
  
  return {
    user: currentUser,
    token,
    isAuthenticated: !!currentUser
  };
};