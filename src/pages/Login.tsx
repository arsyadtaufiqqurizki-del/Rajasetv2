import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { KeyRound, ShieldAlert } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (code.trim() === '') {
      setError('Please enter a login code.');
      return;
    }

    const success = login(code);
    if (!success) {
      setError('Invalid code. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-blue-600">
          <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
            <KeyRound className="h-6 w-6" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Temporary access using your numeric code
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700">
                Access Code
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <input
                  id="code"
                  name="code"
                  type="password"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className={`appearance-none block w-full px-3 py-2 border ${
                    error ? 'border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500'
                  } rounded-md shadow-sm focus:outline-none sm:text-sm`}
                  placeholder="Enter your numeric code"
                />
              </div>
              {error && (
                <div className="mt-2 flex items-center text-sm text-red-600">
                  <ShieldAlert className="h-4 w-4 mr-1" />
                  {error}
                </div>
              )}
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Sign in
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
