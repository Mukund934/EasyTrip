import { ToastContainer } from 'react-toastify';
import { AuthProvider } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import GoogleOneTap from '../components/GoogleOneTap';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/globals.css';
import { UserProvider } from '../context/UserContext';

function MyApp({ Component, pageProps }) {
  // Use the layout defined at the page level, if available
  const getLayout = Component.getLayout || ((page) => page);

  return (
    <AuthProvider>
      <UserProvider>
        <div className="flex flex-col min-h-screen">
          <Navbar />
          <main className="flex-grow">
            {getLayout(<Component {...pageProps} />)}
          </main>
          <Footer />
        </div>
        <GoogleOneTap />
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
      </UserProvider>
    </AuthProvider>
  );
}

export default MyApp;
