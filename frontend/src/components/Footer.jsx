import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiMapPin, FiMail, FiPhone, FiFacebook, FiInstagram, FiTwitter, FiLinkedin, FiYoutube, FiArrowRight } from 'react-icons/fi';

const Footer = () => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email) {
      // Here you would normally send the email to your API
      setSubscribed(true);
      setEmail('');
      // Reset the subscribed state after 5 seconds
      setTimeout(() => setSubscribed(false), 5000);
    }
  };

  const socialLinks = [
    { icon: <FiFacebook className="h-5 w-5" />, href: "#", name: "Facebook" },
    { icon: <FiInstagram className="h-5 w-5" />, href: "#", name: "Instagram" },
    { icon: <FiTwitter className="h-5 w-5" />, href: "#", name: "Twitter" },
    { icon: <FiLinkedin className="h-5 w-5" />, href: "#", name: "LinkedIn" },
    { icon: <FiYoutube className="h-5 w-5" />, href: "#", name: "YouTube" },
  ];

  const quickLinks = [
    { name: "Home", href: "/" },
    { name: "Destinations", href: "/destinations" },
    { name: "About Us", href: "/about" },
    { name: "Contact", href: "/contact" },
    { name: "Privacy Policy", href: "/privacy" },
    { name: "Terms of Service", href: "/terms" },
  ];

  const popularDestinations = [
    { name: "Agra", href: "#" },
    { name: "Jaipur", href: "#" },
    { name: "Goa", href: "#" },
    { name: "Mumbai", href: "#" },
    { name: "Delhi", href: "#" },
  ];

  return (
    <footer className="relative bg-gray-900 text-white overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500 via-yellow-400 to-primary-600"></div>
      
      <div className="absolute top-20 right-20 w-72 h-72 bg-primary-600 rounded-full opacity-10 blur-3xl"></div>
      <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-blue-600 rounded-full opacity-10 blur-3xl"></div>

      {/* Footer Content */}
      <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Footer Top */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Company Info */}
          <div className="lg:col-span-2">
            <div className="flex items-center mb-6">
              <div className="bg-white rounded-lg p-2 mr-3">
                <img src="/images/logo.png" alt="EasyTrip Logo" className="h-8 w-auto" />
              </div>
              <h2 className="text-2xl font-bold text-white">EasyTrip</h2>
            </div>
            <p className="text-gray-300 mb-6 max-w-md">
              Discover amazing destinations around the world with EasyTrip. We help you find the perfect places to visit, with detailed information and beautiful imagery.
            </p>
            
            {/* Social Media Links */}
            <div className="flex space-x-4">
              {socialLinks.map((social, index) => (
                <motion.a
                  key={index}
                  href={social.href}
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-800 text-gray-300 hover:bg-primary-600 hover:text-white transition-colors"
                  whileHover={{ y: -5, backgroundColor: "#0EA5E9", color: "#FFFFFF" }}
                  whileTap={{ scale: 0.9 }}
                  title={social.name}
                >
                  {social.icon}
                </motion.a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-1">
            <h3 className="text-lg font-semibold mb-6 border-b border-gray-700 pb-2">Quick Links</h3>
            <ul className="space-y-3">
              {quickLinks.map((link, index) => (
                <motion.li key={index} whileHover={{ x: 5 }}>
                  <Link href={link.href} className="text-gray-300 hover:text-primary-400 transition-colors flex items-center">
                    <span className="text-xs mr-2">›</span>
                    {link.name}
                  </Link>
                </motion.li>
              ))}
            </ul>
          </div>

          {/* Popular Destinations */}
          <div className="lg:col-span-1">
            <h3 className="text-lg font-semibold mb-6 border-b border-gray-700 pb-2">Popular Destinations</h3>
            <ul className="space-y-3">
              {popularDestinations.map((destination, index) => (
                <motion.li key={index} whileHover={{ x: 5 }}>
                  <Link href={destination.href} className="text-gray-300 hover:text-primary-400 transition-colors flex items-center">
                    <span className="text-xs mr-2">›</span>
                    {destination.name}
                  </Link>
                </motion.li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div className="lg:col-span-1">
            <h3 className="text-lg font-semibold mb-6 border-b border-gray-700 pb-2">Newsletter</h3>
            <p className="text-gray-300 mb-4 text-sm">
              Subscribe to our newsletter for the latest updates and travel inspiration.
            </p>
            
            {subscribed ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-green-900/30 border border-green-700 rounded-lg p-3 text-green-400 text-sm"
              >
                Thanks for subscribing!
              </motion.div>
            ) : (
              <form onSubmit={handleSubscribe} className="space-y-3">
                <div className="flex">
                  <input
                    type="email"
                    placeholder="Your email"
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-l-lg text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <motion.button
                    type="submit"
                    className="px-3 py-2 bg-primary-600 text-white rounded-r-lg"
                    whileHover={{ backgroundColor: "#0284C7" }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <FiArrowRight />
                  </motion.button>
                </div>
              </form>
            )}
            
            {/* Contact Info */}
            <div className="mt-6 space-y-4">
              <div className="flex items-start">
                <FiMapPin className="h-5 w-5 mr-3 text-primary-500 mt-0.5" />
                <span className="text-gray-300 text-sm">
                  123 Travel Street, Tourism City, 12345
                </span>
              </div>
              <div className="flex items-center">
                <FiPhone className="h-5 w-5 mr-3 text-primary-500" />
                <span className="text-gray-300 text-sm">+1 (123) 456-7890</span>
              </div>
              <div className="flex items-center">
                <FiMail className="h-5 w-5 mr-3 text-primary-500" />
                <span className="text-gray-300 text-sm">info@easytrip.com</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="mt-12 pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm mb-4 md:mb-0">
              &copy; {new Date().getFullYear()} EasyTrip. All rights reserved.
            </p>
            <div className="flex space-x-6">
              <Link href="/privacy" className="text-gray-400 hover:text-primary-400 text-sm">Privacy Policy</Link>
              <Link href="/terms" className="text-gray-400 hover:text-primary-400 text-sm">Terms of Service</Link>
              <Link href="/cookies" className="text-gray-400 hover:text-primary-400 text-sm">Cookie Policy</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;