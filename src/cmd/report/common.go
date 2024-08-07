package report

import (
	"github.com/spf13/cobra"
)

var reportCmd = &cobra.Command{
	Use:     "report",
	Aliases: []string{"r"},
	Short:   "Collection of report commands to make assessor life easier",
}

// Include adds the tools command to the root command.
func Include(rootCmd *cobra.Command) {
	rootCmd.AddCommand(reportCmd)
}
