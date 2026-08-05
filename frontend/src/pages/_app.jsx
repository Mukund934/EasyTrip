import { useRouter } from 'next/router';
import { MotionConfig } from 'framer-motion';
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
    /* One switch for all 403 framer-motion elements (IMP-082). Their animations are JS-driven
       inline styles, so the CSS media query in globals.css cannot reach them; `reducedMotion="user"`
       makes every motion component below honour the OS setting without touching a single call site.
       Transforms and opacity fades are suppressed while layout animations still settle instantly,
       which is the behaviour vestibular-disorder guidance actually asks for. */
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <UserProvider>
          <div className="flex flex-col min-h-screen">
            {/* Lets keyboard and screen-reader users jump past the nav to the page content
                instead of tabbing the whole menu on every navigation (IMP-077). */}
            <a
              href="#main-content"
              className="sr-only-focusable absolute left-4 top-4 z-[100] rounded-lg bg-primary-600 px-4 py-2 text-white font-medium shadow-lg"
            >
              Skip to main content
            </a>
            <Navbar />
          {/* Wraps the page only, not the chrome: a crash inside a page leaves the navbar and
              footer intact, so the user can still navigate away instead of losing the whole app.
              Keyed on the route so recovering from an error on one page does not carry the error
              state onto the next one (IMP-074). */}
            <main id="main-content" tabIndex={-1} className="flex-grow">
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
    </MotionConfig>
  );
}

export default MyApp;
