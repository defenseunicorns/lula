package tools

import (
	"testing"

	"github.com/spf13/cobra"
	"github.com/stretchr/testify/assert"
)

func TestInclude(t *testing.T) {
	rootCmd := &cobra.Command{Use: "root"}
	Include(rootCmd)
	assert.True(t, containsCommand(rootCmd.Commands(), "tools"), "tools should be a subcommand of rootCmd")
}

func containsCommand(commands []*cobra.Command, name string) bool {
	for _, c := range commands {
		if c.Name() == name {
			return true
		}
	}

	return false
}
