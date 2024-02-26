package toolstest

import (
	"strings"
	"bytes"
	"testing"

	"github.com/defenseunicorns/lula/src/cmd"
	"github.com/defenseunicorns/lula/src/pkg/message"
)

// Tests the lint command.
func TestLintCmd(t *testing.T) {
	message.NoProgress = true
	message.TestMode = true
	tests := []struct {
		name       string
		args       []string
		wantErr    bool
		wantOutput string
	}{
		{

			name:       "Test the Lint command with no file flag.",
			args:       []string{"tools", "lint", ""},
			wantErr:    false,
			wantOutput: "Please specify an input file with the -f flag",
		},
		{
			name:       "Test the Lint command with file flag no file path.",
			args:       []string{"tools", "lint", "-f"},
			wantErr:    true,
			wantOutput: "",
		},

		{
			name:       "Test the Lint command with file flag and one valid OSCAL file path.",
			args:       []string{"tools", "lint", "-f", "../../../test/valid-component-definition.yaml"},
			wantErr:    false,
			wantOutput: "",
		},

		{
			name:       "Test the Lint command with file flag and one invalid version OSCAL file path.",
			args:       []string{"tools", "lint", "-f", "../../../test/invalid-version-component-definition.yaml"},
			wantErr:    false,
			wantOutput: "Failed to create validator: version V1-1-1 is not a valid version",
		},

		{
			name:       "Test the Lint command with file flag and one unsupported OSCAL version file path.",
			args:       []string{"tools", "lint", "-f", "../../../test/unsupported-version-component-definition.yaml"},
			wantErr:    false,
			wantOutput: "Failed to create validator: version 1.0.7 is not supported",
		},
	}

	// loops through the tests and tests checks if the wantErr is true/false
	for _, tt := range tests {
		tt := tt // capture range variable
		t.Run(tt.name, func(t *testing.T) {
			// Save the original LogWriter to restore it later
        	originalLogWriter := message.LogWriter

			// Use defer to ensure the original state is restored after the test
        	defer func() { message.LogWriter = originalLogWriter }()

			// Setup the command with test-specific arguments
			cmd := cmd.GetRootCmd() // Assuming LintCmd is the Cobra command variable
			cmd.SetArgs(tt.args)

			// Capture the output
			buf := new(bytes.Buffer)
			cmd.SetOut(buf)
			cmd.SetErr(buf)
			message.LogWriter = buf

			err := cmd.Execute()

			// Validate error based on test case expectation
			if (err != nil) != tt.wantErr {
				t.Errorf("TestLintCmd error = %v, wantErr %v", err, tt.wantErr)
			}

			if tt.wantOutput != "" && !strings.Contains(buf.String(), tt.wantOutput) {
				t.Errorf("TestLintCmd got output = %v, want %v", buf.String(), tt.wantOutput)
			}
		})
	}
}
