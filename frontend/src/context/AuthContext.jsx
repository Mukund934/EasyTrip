import { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  GoogleAuthProvider,
  updateProfile as updateFirebaseProfile,
  signInWithPopup,
  signInWithCredential,
  getRedirectResult
} from 'firebase/auth';
import axios from 'axios';
import { auth } from '../config/firebase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  // Initialize with null to match on both server and client
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  // Add client-side detection to avoid hydration mismatch
  const [isClient, setIsClient] = useState(false);

  // Mark when component has mounted on client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Store user credentials in localStorage - only on client side
  const storeUserCredentials = (user, admin = false) => {
    // Only run on client-side
    if (typeof window === 'undefined') return;

    if (user) {
      localStorage.setItem('currentUser', user.uid);
      localStorage.setItem('currentUserName', user.displayName || user.email || 'User');
      localStorage.setItem('isAdmin', admin.toString());
      localStorage.setItem('authTimestamp', new Date().toISOString());
      
      console.log(`User credentials stored in localStorage: ${user.uid}`);
    } else {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('currentUserName');
      localStorage.removeItem('isAdmin');
      localStorage.removeItem('authTimestamp');
      
      console.log('User credentials cleared from localStorage');
    }
  };

  // Check if user is an admin
  const checkIfAdmin = async (user) => {
    if (!user) return false;
    
    try {
      // For development - allow specific users to be admin
      if (process.env.NODE_ENV === 'development' && 
          (user.uid === 'dharmendra23101' || 
           user.uid === 'af9GjxDZDeNCT69gLbEkk45md1x1' || 
           user.uid === 'aJJJxZNJXsZgQStO3yL7ahjKZDr1')) {
        console.log(`Development mode: User ${user.uid} is admin`);
        return true;
      }
      
      const token = await user.getIdToken();
      
      // First try to get admin status from token claims
      try {
        const idTokenResult = await user.getIdTokenResult();
        if (idTokenResult.claims.admin === true) {
          return true;
        }
      } catch (error) {
        console.log('No admin claim in token, checking backend...');
      }
      
      // If not in claims, check with backend
      const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
      const response = await axios.get(`${API_URL}/auth/check-admin`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User': user.uid,
          'X-User-Name': user.displayName || user.email || 'User'
        }
      });
      
      if (response.status === 200) {
        return response.data.isAdmin;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking admin status:', error);
      
      // For development - allow specific users to be admin even on error
      if (process.env.NODE_ENV === 'development' && 
          (user.uid === 'dharmendra23101' || 
           user.uid === 'af9GjxDZDeNCT69gLbEkk45md1x1' || 
           user.uid === 'aJJJxZNJXsZgQStO3yL7ahjKZDr1')) {
        console.log(`Development fallback: User ${user.uid} is admin`);
        return true;
      }
      
      return false;
    }
  };

  // Register with email and password
  const register = async (email, password, name) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update profile with name
      if (name) {
        await updateFirebaseProfile(userCredential.user, {
          displayName: name
        });
      }
      
      // Check if admin and store credentials
      const adminStatus = await checkIfAdmin(userCredential.user);
      storeUserCredentials(userCredential.user, adminStatus);
      
      return { success: true, user: userCredential.user };
    } catch (error) {
      console.error('Registration error:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  };

  // Login with email and password
  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Check if admin and store credentials
      const adminStatus = await checkIfAdmin(userCredential.user);
      storeUserCredentials(userCredential.user, adminStatus);
      
      return { success: true, user: userCredential.user };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  };

  // Google Sign-In with Popup
  const googleProvider = new GoogleAuthProvider();
  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      
      // Check if admin and store credentials
      const adminStatus = await checkIfAdmin(result.user);
      storeUserCredentials(result.user, adminStatus);
      
      return { success: true, user: result.user };
    } catch (error) {
      console.error("Error signing in with Google", error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  };

  // Google One Tap Sign-In
  const handleGoogleOneTap = async (credential) => {
    try {
      // Create a Google Auth Provider credential
      const googleCredential = GoogleAuthProvider.credential(null, credential);
      
      // Sign in with the credential
      const result = await signInWithCredential(auth, googleCredential);
      
      // Check if admin and store credentials
      const adminStatus = await checkIfAdmin(result.user);
      storeUserCredentials(result.user, adminStatus);
      
      console.log("Google One-Tap sign-in successful", result.user);
      
      return { success: true, user: result.user };
    } catch (error) {
      console.error("Error with Google One-Tap sign-in", error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  };

  // Logout
  const logout = async () => {
    try {
      await signOut(auth);
      storeUserCredentials(null); // Clear localStorage
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  };

  // Update user profile
  const updateProfile = async (data) => {
    try {
      if (!currentUser) {
        throw new Error('No user logged in');
      }
      
      // Update profile in Firebase if needed
      if (data.name) {
        await updateFirebaseProfile(auth.currentUser, {
          displayName: data.name
        });
      }
      
      // Update custom user data in your backend
      const token = await currentUser.getIdToken();
      const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
      const response = await axios.put(`${API_URL}/auth/profile`, data, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User': currentUser.uid,
          'X-User-Name': currentUser.displayName || currentUser.email || 'User'
        }
      });
      
      if (response.status !== 200) {
        throw new Error('Failed to update profile');
      }
      
      // Update current user state
      const updatedUser = {
        ...currentUser,
        ...data
      };
      
      setCurrentUser(updatedUser);
      
      // Update localStorage
      storeUserCredentials(updatedUser, isAdmin);
      
      return { success: true };
    } catch (error) {
      console.error('Profile update error:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  };

  // Debug auth state for development - safe for SSR
  const debugAuthState = (user, adminStatus) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('--- Auth State Update ---');
      console.log('Current Date/Time:', new Date().toISOString());
      
      if (user) {
        console.log('User:', {
          uid: user.uid,
          email: user.email,
          name: user.displayName,
          isAdmin: adminStatus
        });
      } else {
        console.log('User: Not authenticated');
      }
      
      // Debug localStorage - only if on client
      if (typeof window !== 'undefined') {
        console.log('localStorage:', {
          currentUser: localStorage.getItem('currentUser'),
          currentUserName: localStorage.getItem('currentUserName'),
          isAdmin: localStorage.getItem('isAdmin'),
          authTimestamp: localStorage.getItem('authTimestamp')
        });
      }
      console.log('------------------------');
    }
  };

  // Check localStorage for stored user on client-side only
  useEffect(() => {
    // This effect only runs on client-side after initial render
    if (typeof window !== 'undefined' && !currentUser && !loading) {
      const storedUserId = localStorage.getItem('currentUser');
      const storedUserName = localStorage.getItem('currentUserName');
      const storedIsAdmin = localStorage.getItem('isAdmin') === 'true';
      
      // If we have stored user data but no currentUser from Firebase
      if (storedUserId && !auth.currentUser) {
        console.log('Restoring user from localStorage:', storedUserId);
        
        // Create temporary user object from localStorage
        const tempUser = {
          uid: storedUserId,
          displayName: storedUserName || 'User',
          isAdmin: storedIsAdmin,
          // Add a stub for getIdToken to prevent errors
          getIdToken: () => Promise.resolve('localStorage-token')
        };
        
        setCurrentUser(tempUser);
        setIsAdmin(storedIsAdmin);
      }
    }
  }, [isClient, loading]);

  // Listen for auth state changes - only after initial render
  useEffect(() => {
    // Skip effect during SSR
    if (typeof window === 'undefined') return;
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          // Check if user is an admin
          const adminStatus = await checkIfAdmin(user);
          setIsAdmin(adminStatus);
          
          // Format the user object
          const formattedUser = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email || 'User',
            photoURL: user.photoURL,
            isAdmin: adminStatus,
            getIdToken: () => user.getIdToken()
          };
          
          setCurrentUser(formattedUser);
          
          // Store in localStorage for persistence
          storeUserCredentials(formattedUser, adminStatus);
          
          // Debug for development
          debugAuthState(formattedUser, adminStatus);
        } else {
          // User is signed out
          setCurrentUser(null);
          setIsAdmin(false);
          storeUserCredentials(null); // Clear localStorage
          
          // Debug for development
          debugAuthState(null, false);
        }
      } catch (error) {
        console.error('Error in auth state change handler:', error);
        setCurrentUser(null);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    });

    // Check for Google Redirect result
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          console.log("Signed in with redirect", result.user);
        }
      })
      .catch((error) => {
        console.error("Error with redirect sign-in", error);
      });

    return () => unsubscribe();
  }, [isClient]); // Only run after client-side hydration is complete

  // Remove development mode auto-login to fix hydration issues
  // Development mode user will now be set through auth state change handler

  const value = {
    currentUser,
    loading,
    isAdmin,
    register,
    login,
    logout,
    updateProfile,
    signInWithGoogle,
    handleGoogleOneTap,
    storeUserCredentials,
    isClient // Expose this so components can know when it's safe to render client-only content
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;