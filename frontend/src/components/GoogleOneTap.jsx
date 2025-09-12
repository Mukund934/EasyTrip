import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const GoogleOneTap = () => {
  const { currentUser, signInWithGoogle } = useAuth();
  
  useEffect(() => {
    // Don't initialize if user is already logged in
    if (currentUser) return;
    
    const initializeGoogleOneTap = async () => {
      try {
        // Load the Google One Tap script
        const googleScript = document.createElement('script');
        googleScript.src = 'https://accounts.google.com/gsi/client';
        googleScript.async = true;
        googleScript.defer = true;
        document.body.appendChild(googleScript);
        
        googleScript.onload = () => {
          try {
            // Initialize Google One Tap with FedCM opt-in
            window.google.accounts.id.initialize({
              client_id: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
              callback: handleCredentialResponse,
              auto_select: true,
              cancel_on_tap_outside: true,
              use_fedcm_for_prompt: true // Opt in to FedCM
            });
            
            window.google.accounts.id.prompt((notification) => {
              if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                console.log('One Tap not displayed', notification.getNotDisplayedReason() || notification.getSkippedReason());
              }
            });
          } catch (err) {
            console.warn('Google One Tap initialization error:', err);
          }
        };
      } catch (error) {
        console.error('Error loading Google One Tap:', error);
      }
    };
    
    const handleCredentialResponse = async (response) => {
      try {
        if (response.credential) {
          // Call your sign in method with the credential
          await signInWithGoogle(response.credential);
        }
      } catch (error) {
        console.error('Error during Google auth:', error);
      }
    };
    
    initializeGoogleOneTap();
    
    // Cleanup
    return () => {
      const scriptElement = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (scriptElement) {
        document.body.removeChild(scriptElement);
      }
      
      // Cancel any ongoing prompts
      if (window.google?.accounts?.id) {
        window.google.accounts.id.cancel();
      }
    };
  }, [currentUser, signInWithGoogle]);
  
  return null; // This component doesn't render anything
};

export default GoogleOneTap;