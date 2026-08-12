import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { KeyRound, ShieldAlert } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const { error: loginError } = await login(email, password);
    if (loginError) {
      setError('Invalid email or password. Please try again.');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-12 w-12 bg-primary text-on-primary rounded-full flex items-center justify-center">
            <KeyRound className="h-6 w-6" />
          </div>
        </div>
        <h1 className="mt-6 text-center text-2xl font-bold text-primary tracking-tight">
          RAJA
        </h1>
        <p className="mt-1 text-center text-sm text-on-surface-variant">
          Sign in to Asset Management
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface-container-lowest py-8 px-4 rounded-2xl shadow-xl border border-outline-variant sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-on-surface">
                Email
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm placeholder-on-surface-variant/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-on-surface">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full rounded-lg border px-4 py-2.5 text-sm placeholder-on-surface-variant/60 focus:outline-none focus:ring-1 ${
                    error
                      ? 'border-error focus:border-error focus:ring-error'
                      : 'border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-primary'
                  }`}
                  placeholder="••••••••"
                />
              </div>
              {error && (
                <div className="mt-2 flex items-center text-sm text-error">
                  <ShieldAlert className="h-4 w-4 mr-1 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2.5 px-4 rounded-lg text-sm font-medium text-on-primary bg-primary hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
