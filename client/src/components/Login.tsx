import { FormEvent, useState } from 'react';

// Simple list of banned words for profanity checking
const BANNED_WORDS = ['fuck', 'shit', 'ass', 'bitch', 'dick', 'penis', 'vagina'];

// Simple profanity check function
const containsProfanity = (text: string): boolean => {
    const lowerText = text.toLowerCase();
    return BANNED_WORDS.some(word => lowerText.includes(word));
};

interface LoginProps {
    onLogin: (playerName: string) => void;
}

export function Login({ onLogin }: LoginProps) {
    const [playerName, setPlayerName] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();

        // Validate name length
        if (!playerName.trim()) {
            setError('Please enter a name');
            return;
        }

        if (playerName.length < 3) {
            setError('Name must be at least 3 characters');
            return;
        }

        if (playerName.length > 15) {
            setError('Name must be 15 characters or less');
            return;
        }

        // Validate no profanity
        if (containsProfanity(playerName)) {
            setError('Please choose an appropriate name');
            return;
        }

        // All validation passed
        onLogin(playerName);
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <h1 className="game-title">Last Circle</h1>
                <h2 className="login-subtitle">Enter the arena</h2>

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label htmlFor="playerName">Your Name:</label>
                        <input
                            type="text"
                            id="playerName"
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            placeholder="Enter your name"
                            autoFocus
                        />
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <button type="submit" className="login-button">
                        Join Game
                    </button>
                </form>
            </div>

            <style>
                {`
        .login-container {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          background-color: #121212;
          background-image: linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), 
                            url('/background.jpg');
          background-size: cover;
          background-position: center;
        }
        
        .login-box {
          background-color: rgba(20, 20, 20, 0.9);
          border-radius: 8px;
          padding: 2rem;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .game-title {
          color: #ff3e3e;
          font-size: 3rem;
          margin: 0 0 0.5rem;
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 2px;
          text-shadow: 0 0 10px rgba(255, 62, 62, 0.5);
        }
        
        .login-subtitle {
          color: #aaa;
          font-size: 1.2rem;
          margin: 0 0 2rem;
          text-align: center;
          font-weight: normal;
        }
        
        .input-group {
          margin-bottom: 1.5rem;
        }
        
        label {
          display: block;
          color: #ddd;
          margin-bottom: 0.5rem;
          font-size: 1rem;
        }
        
        input {
          width: 100%;
          padding: 10px;
          border-radius: 4px;
          border: 1px solid #333;
          background-color: #222;
          color: white;
          font-size: 1rem;
          outline: none;
          transition: border-color 0.2s;
        }
        
        input:focus {
          border-color: #ff3e3e;
          box-shadow: 0 0 0 2px rgba(255, 62, 62, 0.2);
        }
        
        .error-message {
          color: #ff3e3e;
          margin-bottom: 1rem;
          font-size: 0.9rem;
        }
        
        .login-button {
          width: 100%;
          padding: 12px;
          background-color: #ff3e3e;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 1rem;
          font-weight: bold;
          cursor: pointer;
          transition: background-color 0.2s;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        
        .login-button:hover {
          background-color: #ff5252;
        }
        
        .login-button:active {
          background-color: #e03131;
          transform: translateY(1px);
        }
        `}
            </style>
        </div>
    );
} 