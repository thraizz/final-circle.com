package config

import (
	"os"
)

// Config holds all server configuration
type Config struct {
	IsDevelopment bool
	Port          string
	UseTLS        bool
	CertFile      string
	KeyFile       string
}

// LoadConfig loads the server configuration from environment variables
func LoadConfig() *Config {
	// Determine if we're in development mode
	isDevelopment := os.Getenv("ENV") != "production"

	// Get port from environment or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = "8001"
	}

	// Get TLS configuration
	certFile := os.Getenv("TLS_CERT_FILE")
	keyFile := os.Getenv("TLS_KEY_FILE")
	useTLS := certFile != "" && keyFile != ""

	return &Config{
		IsDevelopment: isDevelopment,
		Port:          port,
		UseTLS:        useTLS,
		CertFile:      certFile,
		KeyFile:       keyFile,
	}
}
