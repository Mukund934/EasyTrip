import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  onIdTokenChanged,
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

// Must match the fallback used by every other caller (placeService, the admin gates,
// the pages/api image routes). A '/api' default would silently resolve to the Next
// server, which has no auth routes, and admin detection would 404 into `false`.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// The backend refuses to answer if it is down; without a timeout `loading` can hang
// forever and the whole app sits on its auth spinner.
const ADMIN_CHECK_TIMEOUT_MS = 8000;

// Name, Path and SameSite are load-bearing: the four /admin/* getServerSideProps gates
// read `req.cookies.et_id_token`, and only a Lax cookie rides a top-level document
// navigation. A Firebase ID token lives in JS memory, so without this mirror no
// document request to /admin/* carries any credential at all.
const TOKEN_COOKIE = 'et_id_token';

const syncTokenCookie = (token) => {
  if (typeof document === 'undefined') return;

  if (token) {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${TOKEN_COOKIE}=${token}; Path=/; Max-Age=3600; SameSite=Lax${secure}`;
  } else {
    document.cookie = `${TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
};

// Backend validation failures arrive as { message, errors: [{ field, message }] };
// axios only ever surfaces "Request failed with status code 400" on its own.
const apiErrorMessage = (error, fallback) =>
  error?.response?.data?.errors?.[0]?.message ||
  error?.response?.data?.message ||
  error?.message ||
  fallback;

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

  // Get a fresh Firebase ID token for the signed-in user, or null when signed out.
  // Stable identity so consumers can safely use it in effect dependency arrays.
  const getIdToken = useCallback(async () => {
    if (!auth.currentUser) return null;

    try {
      return await auth.currentUser.getIdToken();
    } catch (error) {
      console.error('Error getting ID token:', error);
      return null;
    }
  }, []);

  // Check if user is an admin.
  // `users.is_admin` (via GET /auth/check-admin) is the only authority, deliberately.
  // A Firebase custom `admin` claim used to short-circuit this, but the backend gate
  // denies whenever the claim and the DB column disagree — trusting the claim here
  // would hand a de-admined user the full admin UI and then 403 every call it makes.
  const checkIfAdmin = async (user, idToken) => {
    if (!user) return false;

    try {
      const token = idToken || (await user.getIdToken());

      const response = await axios.get(`${API_URL}/auth/check-admin`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        timeout: ADMIN_CHECK_TIMEOUT_MS
      });

      if (response.status === 200) {
        return response.data.isAdmin === true;
      }

      return false;
    } catch (error) {
      console.error('Error checking admin status:', error.message);
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
      // onIdTokenChanged clears this too, but do it eagerly so a document request
      // fired between signOut() and the listener cannot carry a dead token.
      syncTokenCookie(null);
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
      const token = await getIdToken();
      if (!token) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      const response = await axios.put(`${API_URL}/auth/profile`, data, {
        headers: {
          'Authorization': `Bearer ${token}`
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

      return { success: true };
    } catch (error) {
      console.error('Profile update error:', error);
      return {
        success: false,
        error: apiErrorMessage(error, 'Failed to update profile')
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

      console.log('------------------------');
    }
  };

  // Listen for auth state changes - only after initial render.
  // The Firebase SDK's own persistence is the single source of session truth:
  // `loading` stays true until it resolves, so the UI never renders a stale session.
  // onIdTokenChanged (not onAuthStateChanged) so the mirrored cookie is rewritten
  // when Firebase silently rotates the ~1h ID token, not just on sign-in/sign-out.
  useEffect(() => {
    // Skip effect during SSR
    if (typeof window === 'undefined') return;

    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      try {
        if (user) {
          const token = await user.getIdToken();
          syncTokenCookie(token);

          // Check if user is an admin
          const adminStatus = await checkIfAdmin(user, token);
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

          // Debug for development
          debugAuthState(formattedUser, adminStatus);
        } else {
          // User is signed out
          syncTokenCookie(null);
          setCurrentUser(null);
          setIsAdmin(false);

          // Debug for development
          debugAuthState(null, false);
        }
      } catch (error) {
        console.error('Error in auth state change handler:', error);
        syncTokenCookie(null);
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
    isAuthenticated: !!currentUser,
    loading,
    isAdmin,
    register,
    login,
    logout,
    updateProfile,
    signInWithGoogle,
    handleGoogleOneTap,
    getIdToken,
    isClient // Expose this so components can know when it's safe to render client-only content
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;