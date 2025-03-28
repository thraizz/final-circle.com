import React, { useEffect, useState } from 'react';

interface Lobby {
    id: string;
    name: string;
    playerCount: number;
    maxPlayers: number;
}

export const LandingPage: React.FC<{ onJoinLobby: (lobbyId: string) => void }> = ({ onJoinLobby }) => {
    const [lobbies, setLobbies] = useState<Lobby[]>([
        { id: '1', name: 'Casual Lobby', playerCount: 0, maxPlayers: 100 },
        { id: '2', name: 'Competitive Lobby', playerCount: 0, maxPlayers: 100 },
    ]);

    // In a real implementation, this would be replaced with WebSocket updates
    useEffect(() => {
        const updateLobbyCounts = () => {
            setLobbies(prev => prev.map(lobby => ({
                ...lobby,
                playerCount: Math.floor(Math.random() * 100), // Simulated player count
            })));
        };

        const interval = setInterval(updateLobbyCounts, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="landing-page">
            <h1>Welcome to Last Circle</h1>
            <div className="lobbies-container">
                {lobbies.map(lobby => (
                    <div key={lobby.id} className="lobby-card">
                        <h2>{lobby.name}</h2>
                        <div className="lobby-stats">
                            <p>Players: {lobby.playerCount}/{lobby.maxPlayers}</p>
                        </div>
                        <button
                            onClick={() => onJoinLobby(lobby.id)}
                            disabled={lobby.playerCount >= lobby.maxPlayers}
                            className="join-button"
                        >
                            {lobby.playerCount >= lobby.maxPlayers ? 'Full' : 'Join Game'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}; 