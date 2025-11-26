import React, { useState } from 'react';
import { Button } from "@/components/ui/button";

const Landing = ({ onGoogleSignIn, onEmailSignIn, onEmailSignUp }) => {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!onEmailSignIn || !onEmailSignUp) {
      console.warn('[Landing] email auth callbacks missing');
      return;
    }

    setSubmitting(true);
    setError('');
    console.log(`[Landing] ${mode} attempt`, email);

    try {
      if (mode === 'login') {
        await onEmailSignIn(email, password);
      } else {
        await onEmailSignUp(email, password);
      }
      console.log('[Landing] auth success');
    } catch (err) {
      const rawMessage = err?.message || err?.error_description || '';
      const message = rawMessage || 'Something went wrong. Please try again.';
      setError(message);
      console.error('[Landing] auth error', message, err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="landing-shell">
      <section className="landing-hero">
        <div className="landing-background">
          <div className="floating-logo logo-openai" style={{ '--delay': '0s', '--duration': '15s', '--top': '15%', '--left': '10%' }}>
            <img src="/icons/openai.svg" alt="OpenAI" />
          </div>
          <div className="floating-logo logo-anthropic" style={{ '--delay': '-5s', '--duration': '18s', '--top': '60%', '--left': '15%' }}>
            <img src="/icons/anthropic.svg" alt="Anthropic" />
          </div>
          <div className="floating-logo logo-google" style={{ '--delay': '-2s', '--duration': '20s', '--top': '25%', '--left': '80%' }}>
            <img src="/icons/google.svg" alt="Google" />
          </div>
          <div className="floating-logo logo-meta" style={{ '--delay': '-8s', '--duration': '22s', '--top': '70%', '--left': '75%' }}>
            <img src="/icons/meta.svg" alt="Meta" />
          </div>
          <div className="floating-logo logo-xai" style={{ '--delay': '-12s', '--duration': '25s', '--top': '40%', '--left': '50%' }}>
            <img src="/icons/xai.svg" alt="xAI" />
          </div>
        </div>
        <div className="landing-hero__inner">
          <span className="landing-brand">GroopChat</span>
          <h1 className="landing-headline">
            <span className="landing-headline__accent">Coordinate</span>
            <span className="landing-headline__text">multiple AI voices for richer answers.</span>
          </h1>
          <p className="landing-subcopy">
            Curate a lineup of frontier models, keep every conversation organized, and switch between group or direct replies with a single tap.
          </p>
        </div>
      </section>

      <section className="landing-panel">
        <div className="landing-panel__content">
          <h2 className="landing-panel__title">Get started</h2>
          <p className="landing-panel__subtitle">Log in with Google to join the conversation.</p>

          <form className="landing-form" onSubmit={handleSubmit}>
            <div className="landing-tabs">
              <button
                type="button"
                className={mode === 'login' ? 'landing-tab landing-tab--active' : 'landing-tab'}
                onClick={() => setMode('login')}
              >
                Log in
              </button>
              <button
                type="button"
                className={mode === 'signup' ? 'landing-tab landing-tab--active' : 'landing-tab'}
                onClick={() => setMode('signup')}
              >
                Sign up
              </button>
            </div>

            <div className="landing-fields">
              <label className="landing-field">
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </label>
              <label className="landing-field">
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </label>
            </div>

            {error && <p className="landing-error" role="alert">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="landing-submit"
            >
              {submitting ? 'Please wait…' : mode === 'login' ? 'Continue' : 'Create account'}
            </button>
          </form>

          <div className="landing-divider"><span>or</span></div>

          <Button
            type="button"
            onClick={onGoogleSignIn}
            size="lg"
            className="landing-google-btn"
          >
            <svg
              className="landing-google-btn__icon"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
            >
              <path
                d="M21.35 11.1h-9.4v2.97h5.41c-.24 1.26-.98 2.33-2.09 3.05v2.52h3.38c1.98-1.83 3.13-4.53 3.13-7.69 0-.64-.06-1.26-.18-1.85z"
                fill="#4285F4"
              />
              <path
                d="M11.95 22c2.83 0 5.2-.94 6.93-2.56l-3.38-2.52c-.94.63-2.14.99-3.55.99-2.73 0-5.04-1.84-5.86-4.32h-3.5v2.66C3.95 18.81 7.64 22 11.95 22z"
                fill="#34A853"
              />
              <path
                d="M6.09 13.59A6.03 6.03 0 016.09 10V7.34h-3.5a10.02 10.02 0 000 9.32l3.5-3.07z"
                fill="#FBBC05"
              />
              <path
                d="M11.95 5.04c1.54 0 2.92.53 4.01 1.57l3-3.01C16.8 1.43 14.43.4 11.95.4 7.64.4 3.95 3.59 2.59 7.34L6.09 10c.82-2.48 3.13-4.32 5.86-4.96z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </Button>

          <div className="landing-links">
            <a href="#" className="landing-link">Terms of use</a>
            <span aria-hidden>·</span>
            <a href="#" className="landing-link">Privacy policy</a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
