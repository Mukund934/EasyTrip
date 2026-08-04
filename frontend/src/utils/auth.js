import { auth } from '../config/firebase';

/**
 * Helper function to get authenticated user information
 * and token in a consistent way across the application
 */
export const getAuth = async () => {
  const currentUser = auth.currentUser;

  let token = null;
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
