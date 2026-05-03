import { Link } from 'react-router-dom';

export default function PageNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#0a0a14" }}>
      <div className="max-w-md w-full text-center space-y-8">
        {/* Logo */}
        <img
          src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png"
          alt="Marketing iO"
          className="h-10 mx-auto object-contain"
          style={{ filter: "invert(1) brightness(2)", mixBlendMode: "screen" }}
        />

        {/* 404 */}
        <div>
          <h1 className="text-8xl font-bold gradient-text">404</h1>
          <h2 className="text-2xl font-semibold mt-3" style={{ color: "#f4f4fa" }}>Page not found</h2>
          <p className="text-sm mt-2" style={{ color: "#a8a8c0" }}>
            The page you're looking for doesn't exist or you don't have access.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/forgot-password"
            className="px-5 py-2.5 rounded-xl text-sm font-medium gradient-bg text-white hover:opacity-90 transition-opacity"
          >
            Go to Login
          </Link>
          <Link
            to="/"
            className="px-5 py-2.5 rounded-xl text-sm font-medium border text-sm"
            style={{ borderColor: "rgba(255,255,255,0.15)", color: "#a8a8c0" }}
          >
            Go to Home
          </Link>
        </div>
      </div>
    </div>
  );
}