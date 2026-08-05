import { useRouter } from 'next/router';
import { ToastContainer } from 'react-toastify';
import { AuthProvider } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ErrorBoundary from '../components/ErrorBoundary';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/globals.css';
import { UserProvider } from '../context/UserContext';

function MyApp({ Component, pageProps }) {
  const router = useRouter();
  // Use the layout defined at the page level, if available
  const getLayout = Component.getLayout || ((page) => page);

  return (
    <AuthProvider>
      <UserProvider>
        <div className="flex flex-col min-h-screen">
          <Navbar />
          {/* Wraps the page only, not the chrome: a crash inside a page leaves the navbar and
              footer intact, so the user can still navigate away instead of losing the whole app.
              Keyed on the route so recovering from an error on one page does not carry the error
              state onto the next one (IMP-074). */}
          <main className="flex-grow">
            <ErrorBoundary key={router.asPath}>
              {getLayout(<Component {...pageProps} />)}
            </ErrorBoundary>
          </main>
          <Footer />
        </div>
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
