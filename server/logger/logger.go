package logger

import (
	"log"
	"os"
)

var (
	// InfoLogger logs informational messages
	InfoLogger *log.Logger
	// ErrorLogger logs error messages
	ErrorLogger *log.Logger
	// DebugLogger logs debug messages (only in development)
	DebugLogger *log.Logger
)

// Init initializes the loggers based on the environment
func Init(isDevelopment bool) {
	// Error logger always logs to stderr
	ErrorLogger = log.New(os.Stderr, "ERROR: ", log.LstdFlags)

	if isDevelopment {
		// In development, log everything to stdout with different prefixes
		InfoLogger = log.New(os.Stdout, "INFO: ", log.LstdFlags)
		DebugLogger = log.New(os.Stdout, "DEBUG: ", log.LstdFlags)
	} else {
		// In production, only log errors and important info
		InfoLogger = log.New(os.Stdout, "INFO: ", log.LstdFlags)
		DebugLogger = log.New(os.Stderr, "DEBUG: ", log.LstdFlags)
		DebugLogger.SetOutput(os.Stderr) // Discard debug logs in production
	}
}
