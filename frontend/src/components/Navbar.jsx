import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { FiMenu, FiX, FiUser, FiLogOut, FiHome, FiMap, FiLogIn, FiUserPlus, FiSettings, FiChevronDown, FiClock, FiInfo, FiCompass, FiSearch } from 'react-icons/fi';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState('2025-09-05 22:26:25');
  const [currentUser] = useState('dharmendra23101');
  const { currentUser: authUser, isAdmin, logout } = useAuth();
  const router = useRouter();

  // Close menu when route changes
  useEffect(() => {
    setIsOpen(false);
    setIsProfileOpen(false);
  }, [router.pathname]);

  // Change navbar style on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Log logout action
  const handleLogout = async () => {
    console.log(`User ${currentUser} logging out at ${currentDateTime}`);
    await logout();
    router.push('/');
  };

  const menuVariants = {
    hidden: {
      opacity: 0,
      y: -20,
      transition: {
        duration: 0.2
      }
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.nav
      className={`fixed w-full top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white shadow-md py-2' : 'bg-transparent py-4'
        }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0 flex items-center">
            <div className="relative h-10 w-10 mr-2">
              <Image
                src="/images/logo.png"
                alt="EasyTrip Logo"
                width={40}
                height={40}
                className="rounded-md"
              />
            </div>
            <motion.span
              className={`text-2xl font-bold ${scrolled ? 'text-primary-600' : 'text-white'}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              EasyTrip
            </motion.span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden sm:ml-6 sm:flex sm:items-center sm:space-x-8">
            <Link
              href="/"
              className={`px-3 py-2 text-sm font-medium ${router.pathname === '/'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : scrolled ? 'text-gray-700 hover:text-primary-600' : 'text-white hover:text-primary-200'
                } transition-colors`}
            >
              <span className="flex items-center">
                <FiHome className="mr-2" />
                Home
              </span>
            </Link>
            <Link
              href="/browse"
              className={`px-3 py-2 text-sm font-medium ${router.pathname === '/browse'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : scrolled ? 'text-gray-700 hover:text-primary-600' : 'text-white hover:text-primary-200'
                } transition-colors`}
            >
              <span className="flex items-center">
                <FiCompass className="mr-2" />
                Browse
              </span>
            </Link>
            <Link
              href="/search"
              className={`px-3 py-2 text-sm font-medium ${router.pathname === '/search'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : scrolled ? 'text-gray-700 hover:text-primary-600' : 'text-white hover:text-primary-200'
                } transition-colors`}
            >
              <span className="flex items-center">
                <FiSearch className="mr-2" />
                Search
              </span>
            </Link>

            {authUser ? (
              <div className="relative ml-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className={`flex items-center space-x-2 ${scrolled ? 'bg-gray-100 text-gray-800' : 'bg-white/20 text-white'
                    } backdrop-blur-sm px-4 py-2 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors`}
                >
                  {authUser.photoURL ? (
                    <img
                      src={authUser.photoURL}
                      alt="Profile"
                      className="w-7 h-7 rounded-full"
                    />
                  ) : (
                    <div className="relative w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-bold">
                      {authUser.name ? authUser.name.charAt(0).toUpperCase() : authUser.email.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm font-medium truncate max-w-[100px]">
                    {authUser.name || authUser.email.split('@')[0]}
                  </span>
                  <FiChevronDown className={`h-4 w-4 ${isProfileOpen ? 'rotate-180' : 'rotate-0'} transition-transform duration-200`} />
                </motion.button>

                <AnimatePresence>
                  {isProfileOpen && (
                    <motion.div
                      className="absolute right-0 mt-2 w-60 rounded-xl shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 z-10 overflow-hidden"
                      variants={menuVariants}
                      initial="hidden"
                      animate="visible"
                      exit="hidden"
                    >
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm text-gray-500">Signed in as</p>
                        <p className="text-sm font-medium text-gray-900 truncate">{authUser.email}</p>
                        <div className="mt-1 flex items-center text-xs text-gray-500">
                          <FiClock className="mr-1 h-3 w-3" />
                          <span>{currentDateTime}</span>
                        </div>
                        <div className="flex items-center text-xs text-gray-500">
                          <FiUser className="mr-1 h-3 w-3" />
                          <span>{currentUser}</span>
                        </div>
                      </div>
                      <div className="py-1">
                        <motion.div variants={itemVariants}>
                          <Link
                            href="/profile"
                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <FiUser className="mr-3 h-4 w-4 text-gray-500" />
                            My Profile
                          </Link>
                        </motion.div>

                        {isAdmin && (
                          <motion.div variants={itemVariants}>
                            <Link
                              href="/admin"
                              className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              <FiSettings className="mr-3 h-4 w-4 text-gray-500" />
                              Admin Dashboard
                            </Link>
                          </motion.div>
                        )}

                        <motion.div variants={itemVariants}>
                          <Link
                            href="/activity"
                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <FiInfo className="mr-3 h-4 w-4 text-gray-500" />
                            Activity Log
                          </Link>
                        </motion.div>

                        <div className="border-t border-gray-100 my-1"></div>

                        <motion.div variants={itemVariants}>
                          <button
                            onClick={handleLogout}
                            className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <FiLogOut className="mr-3 h-4 w-4" />
                            Sign out
                          </button>
                        </motion.div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  href="/login"
                  className={`px-4 py-2 text-sm font-medium rounded-md ${scrolled
                      ? 'text-primary-600 border border-primary-600 hover:bg-primary-50'
                      : 'text-white border border-white hover:bg-white/10'
                    } transition-colors`}
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className={`px-4 py-2 text-sm font-medium rounded-md ${scrolled
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : 'bg-white text-primary-800 hover:bg-primary-50'
                    } shadow-sm transition-colors`}
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Navigation Button */}
          <div className="flex items-center sm:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`inline-flex items-center justify-center p-2 rounded-md ${scrolled ? 'text-gray-700 hover:text-primary-600' : 'text-white hover:text-primary-200'
                } hover:bg-opacity-20 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 transition-colors`}
            >
              <span className="sr-only">{isOpen ? 'Close menu' : 'Open menu'}</span>
              {isOpen ? (
                <FiX className="block h-6 w-6" />
              ) : (
                <FiMenu className="block h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="sm:hidden bg-white shadow-lg absolute top-full left-0 right-0"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="px-2 pt-2 pb-3 space-y-1 divide-y divide-gray-200">
              <div className="py-2">
                <Link
                  href="/"
                  className={`block px-3 py-2 rounded-md text-base font-medium ${router.pathname === '/'
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-primary-600'
                    }`}
                >
                  <div className="flex items-center">
                    <FiHome className="mr-3 h-5 w-5" />
                    Home
                  </div>
                </Link>

                <Link
                  href="/browse"
                  className={`block px-3 py-2 rounded-md text-base font-medium ${router.pathname === '/browse'
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-primary-600'
                    }`}
                >
                  <div className="flex items-center">
                    <FiCompass className="mr-3 h-5 w-5" />
                    Browse
                  </div>
                </Link>

                <Link
                  href="/search"
                  className={`block px-3 py-2 rounded-md text-base font-medium ${router.pathname === '/search'
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-primary-600'
                    }`}
                >
                  <div className="flex items-center">
                    <FiSearch className="mr-3 h-5 w-5" />
                    Search
                  </div>
                </Link>
              </div>

              <div className="py-2">
                {authUser ? (
                  <>
                    <div className="px-3 py-2 border-b border-gray-200 mb-2">
                      <p className="text-sm text-gray-500">Signed in as</p>
                      <p className="text-base font-medium text-gray-900 truncate">{authUser.email}</p>
                      <div className="mt-1 flex items-center text-xs text-gray-500">
                        <FiClock className="mr-1 h-3 w-3" />
                        <span>{currentDateTime}</span>
                      </div>
                      <div className="flex items-center text-xs text-gray-500">
                        <FiUser className="mr-1 h-3 w-3" />
                        <span>{currentUser}</span>
                      </div>
                    </div>

                    <Link
                      href="/profile"
                      className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-primary-600"
                    >
                      <div className="flex items-center">
                        <FiUser className="mr-3 h-5 w-5" />
                        My Profile
                      </div>
                    </Link>

                    <Link
                      href="/activity"
                      className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-primary-600"
                    >
                      <div className="flex items-center">
                        <FiInfo className="mr-3 h-5 w-5" />
                        Activity Log
                      </div>
                    </Link>

                    {isAdmin && (
                      <Link
                        href="/admin"
                        className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-primary-600"
                      >
                        <div className="flex items-center">
                          <FiSettings className="mr-3 h-5 w-5" />
                          Admin Dashboard
                        </div>
                      </Link>
                    )}

                    <button
                      onClick={handleLogout}
                      className="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-red-50"
                    >
                      <div className="flex items-center">
                        <FiLogOut className="mr-3 h-5 w-5" />
                        Sign out
                      </div>
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-primary-600"
                    >
                      <div className="flex items-center">
                        <FiLogIn className="mr-3 h-5 w-5" />
                        Login
                      </div>
                    </Link>
                    <Link
                      href="/signup"
                      className="block px-3 py-2 rounded-md text-base font-medium text-primary-600 hover:bg-primary-50"
                    >
                      <div className="flex items-center">
                        <FiUserPlus className="mr-3 h-5 w-5" />
                        Sign Up
                      </div>
                    </Link>
                  </>
                )}
              </div>
            </div>
            
            {/* Footer with timestamp */}
            <div className="px-4 py-2 bg-gray-50 text-center">
              <div className="text-xs text-gray-500">
                {currentDateTime} • {currentUser}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navbar background overlay for transparent navbar */}
      {!scrolled && (
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 to-transparent -z-10"></div>
      )}
    </motion.nav>
  );
};

export default Navbar;