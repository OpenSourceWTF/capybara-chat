/**
 * LoginPage - GitHub OAuth Login Screen
 *
 * 032-multitenancy: Shown when user is not authenticated.
 * Clicking "Sign in with GitHub" redirects to the server's OAuth flow.
 * Matches the Cozy Terminal aesthetic (warm tones, monospace, zero border radius).
 */

import { useAuth } from '../../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-8 p-8"
      style={{ background: 'var(--background)' }}
    >
      <div className="flex flex-col items-center gap-4">
        <img src="/capybara.png" alt="" className="w-20 h-20 opacity-80" />
        <h1
          className="text-2xl font-semibold tracking-tight"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--foreground)' }}
        >
          Capybara
        </h1>
        <p
          className="text-sm max-w-md text-center"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--foreground-muted, var(--muted-foreground))' }}
        >
          AI agent orchestration platform.
          <br />
          Sign in with GitHub to continue.
        </p>
      </div>

      <button
        onClick={login}
        className="flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors cursor-pointer border"
        style={{
          fontFamily: 'var(--font-mono)',
          background: 'var(--foreground)',
          color: 'var(--background)',
          borderColor: 'var(--foreground)',
          borderRadius: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--primary)';
          e.currentTarget.style.borderColor = 'var(--primary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--foreground)';
          e.currentTarget.style.borderColor = 'var(--foreground)';
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
        Sign in with GitHub
      </button>

      <p
        className="text-xs"
        style={{ fontFamily: 'var(--font-mono)', color: 'var(--foreground-muted, var(--muted-foreground))', opacity: 0.6 }}
      >
        your repositories stay private. we only read what you allow.
      </p>
    </div>
  );
}
