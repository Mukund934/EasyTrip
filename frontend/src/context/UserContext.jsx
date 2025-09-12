import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const UserContext = createContext();

export function UserProvider({ children }) {
  const { currentUser } = useAuth();
  const [username, setUsername] = useState('Guest');
  const [currentTime, setCurrentTime] = useState(
    new Date().toISOString().slice(0, 19).replace('T', ' ')
  );
  
  useEffect(() => {
    if (currentUser) {
      // Get username from auth user
      setUsername(
        currentUser.displayName || 
        currentUser.email?.split('@')[0] || 
        currentUser.name || 
        'Guest'
      );
    }
    
    // Update time periodically
    const intervalId = setInterval(() => {
      setCurrentTime(new Date().toISOString().slice(0, 19).replace('T', ' '));
    }, 60000); // Update every minute
    
    return () => clearInterval(intervalId);
  }, [currentUser]);
  
  const value = {
    username,
    currentTime,
    user: currentUser
  };
  
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  return useContext(UserContext);
}