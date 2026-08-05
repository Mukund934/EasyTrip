import { useRouter } from 'next/router';
import { Inter, Playfair_Display } from 'next/font/google';
import { MotionConfig } from 'framer-motion';
import { ToastContainer } from 'react-toastify';
import { AuthProvider } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ErrorBoundary from '../components/ErrorBoundary';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/globals.css';
import { UserProvider } from '../context/UserContext';

/**
 * Self-hosted fonts (IMP-041).
 *
 * These were a `<link rel="stylesheet">` to fonts.googleapis.com in `_document`: render-blocking,
 * on a third-party origin, and costing a second hop to fonts.gstatic.com once the CSS resolved.
 * `next/font` downloads the files at build time and serves them from the app's own origin with
 * the right preload hints, so the critical path loses a DNS lookup, a TLS handshake and a
 * round trip on every cold visit.
 *
 * `display: 'swap'` keeps text visible while the face loads, and each family is exposed as a CSS
 * variable so `tailwind.config.js` can point `font-sans` / `font-serif` at it — the class names
 * used throughout the app do not change.
 */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter'
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '700', '900'],
  style: ['normal', 'italic'],
  variable: '--font-playfair'
});

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
          {/* The variables have to land on an element that wraps everything, including portalled
              toasts, so every `font-sans` / `font-serif` in the tree can resolve them. */}
          <div className={`${inter.variable} ${playfair.variable} flex flex-col min-h-screen`}>
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
