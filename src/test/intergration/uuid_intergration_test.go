package toolstest

import (
	"strings"
	"bytes"
	"testing"

	"github.com/defenseunicorns/lula/src/cmd"
	"github.com/defenseunicorns/lula/src/pkg/message"
)

// Tests the uuidgen command.
func TestUUIDGENCmd(t *testing.T) {
	message.NoProgress = true
	message.TestMode = true
	tests := []struct {
		name       string
		args       []string
		wantErr    bool
		wantOutput string
	}{
		{

			name: "Test the uuidCmd with no arguments.",
			args: []string{"tools", "uuidgen", ""},
			wantErr: false,
			wantOutput: "",
		},
		{
			name: "Test the uuidCmd with one argument.",
			args: []string{"tools", "uuidgen", "https://lula.dev"},
			wantErr: false,
			wantOutput: "",
		},

		{
			name: "Test the uuidCmd with too many arguments.",
			args: []string{"tools", "uuidgen", "https://lula.dev", "https://lula2.dev"},
			wantErr: false,
			wantOutput: "Test Mode Error Encountered: too many arguments",
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
