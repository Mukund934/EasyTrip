import { useState, useRef } from 'react';
import { FiSearch, FiMapPin, FiX, FiFilter } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

const SearchBar = ({ locations = [], onSearch, loading = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef(null);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    console.log(`Submitting search: Term=${searchTerm}, Location=${selectedLocation}`);
    onSearch({ 
      term: searchTerm, 
      location: selectedLocation 
    });
  };
  
  const handleClear = () => {
    setSearchTerm('');
    setSelectedLocation('');
    onSearch({ term: '', location: '' });
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };
  
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };
  
  return (
    <div className="w-full bg-white rounded-lg shadow-xl overflow-hidden transition-all duration-300">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          {/* Main Search Input */}
          <div className="flex items-center p-4">
            <FiSearch className="text-gray-400 mr-3 h-5 w-5 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Where do you want to go?"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full focus:outline-none text-gray-700 text-lg placeholder-gray-400"
              onFocus={() => setIsExpanded(true)}
            />
            
            {searchTerm && (
              <button 
                type="button" 
                onClick={() => setSearchTerm('')}
                className="text-gray-400 hover:text-gray-600 mr-2"
              >
                <FiX className="h-5 w-5" />
              </button>
            )}
            
            <button
              type="button"
              onClick={toggleExpand}
              className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 md:hidden"
            >
              <FiFilter className="h-4 w-4" />
            </button>
          </div>
          
          {/* Additional Search Options */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="border-t border-gray-200 overflow-hidden"
              >
                <div className="p-4 flex flex-col md:flex-row md:items-center">
                  <div className="flex items-center mb-4 md:mb-0 md:mr-4 flex-1">
                    <FiMapPin className="text-gray-400 mr-3 h-5 w-5 flex-shrink-0" />
                    <select
                      value={selectedLocation}
                      onChange={(e) => setSelectedLocation(e.target.value)}
                      className="w-full focus:outline-none text-gray-700 bg-transparent"
                    >
                      <option value="">All Locations</option>
                      {locations.map((loc, index) => (
                        <option key={index} value={loc}>{loc}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex space-x-3">
                    {(searchTerm || selectedLocation) && (
                      <button
                        type="button"
                        onClick={handleClear}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Clear
                      </button>
                    )}
                    
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2 bg-primary-600 text-white rounded-md font-medium hover:bg-primary-700 transition-colors disabled:bg-primary-400"
                    >
                      {loading ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Searching...
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <FiSearch className="mr-2" />
                          Search
                        </span>
                      )}
                    </button>
                  </div>
                </div>
                
                {/* Location tags */}
                {locations.length > 0 && (
                  <div className="px-4 pb-4 flex flex-wrap gap-2">
                    {locations.slice(0, 8).map((loc, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setSelectedLocation(loc)}
                        className={`text-xs px-3 py-1 rounded-full ${
                          selectedLocation === loc
                            ? 'bg-primary-100 text-primary-800'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {loc}
                      </button>
                    ))}
                    {locations.length > 8 && (
                      <span className="text-xs text-gray-500 flex items-center">
                        +{locations.length - 8} more
                      </span>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </form>
      
      {/* Time and user stamp */}
      <div className="bg-gray-50 px-4 py-1 text-xs text-gray-500 text-right border-t border-gray-100">
        
      </div>
    </div>
  );
};

export default SearchBar;