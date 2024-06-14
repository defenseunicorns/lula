package tools

import (
	"github.com/defenseunicorns/go-oscal/src/pkg/validation"
	"github.com/defenseunicorns/lula/src/config"
	"github.com/defenseunicorns/lula/src/pkg/message"
	"github.com/spf13/cobra"
)

type flags struct {
	InputFiles []string // -f --input-files
	ResultFile string   // -r --result-file
}

var opts = &flags{}

var lintHelp = `
To lint existing OSCAL files:
	lula tools lint -f <path to oscal file1>,<path to oscal file2>,...
`

func init() {
	lintCmd := &cobra.Command{
		Use:   "lint",
		Short: "Validate OSCAL against schema",
		PersistentPreRun: func(cmd *cobra.Command, args []string) {
			config.SkipLogFile = true
		},
		Long:    "Validate OSCAL documents are properly configured against the OSCAL schema",
		Example: lintHelp,
		Run: func(cmd *cobra.Command, args []string) {
			var validationResults []validation.ValidationResult
			var errorsOccurred bool

			for _, inputFile := range opts.InputFiles {
				spinner := message.NewProgressSpinner("Linting %s\n", inputFile)
				defer spinner.Stop()

				validationResp, err := validation.ValidationCommand(inputFile)


				if err != nil {
					message.Warnf("Failed to lint %s: %v\n", inputFile, err)
					errorsOccurred = true
					continue
				}

				for _, warning := range validationResp.Warnings {
					message.Warn(warning)
				}

				validationResults = append(validationResults, validationResp.Result)

				message.Infof("Successfully validated %s is valid OSCAL version %s %s\n", inputFile, validationResp.Validator.GetSchemaVersion(), validationResp.Validator.GetModelType())
				spinner.Success()
			}

			if opts.ResultFile != "" {
				err := validation.WriteValidationResults(validationResults, opts.ResultFile)
				if err != nil {
					message.Fatalf(err, "Failed to write validation results to %s\n", opts.ResultFile)
				}
			}

			if errorsOccurred {
				message.Fatalf(nil, "Some files failed to lint. Check the error messages above.\n")
			} else {
				message.Infof("All files successfully validated.\n")
			}
		},
	}

	toolsCmd.AddCommand(lintCmd)

	lintCmd.Flags().StringSliceVarP(&opts.InputFiles, "input-files", "f", []string{}, "the paths to oscal json schema files")
	lintCmd.Flags().StringVarP(&opts.ResultFile, "result-file", "r", "", "the path to write the validation result")
}
