package generate

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"

	"github.com/defenseunicorns/lula/src/cmd/common"
	"github.com/defenseunicorns/lula/src/internal/template"
	"github.com/defenseunicorns/lula/src/pkg/common/network"
	"github.com/defenseunicorns/lula/src/pkg/common/oscal"
	"github.com/defenseunicorns/lula/src/pkg/message"
)

var sspExample = `
To generate a system security plan from profile and component definition:
	lula generate system-security-plan -p <path/to/profile> -c <path/to/component-definition>

To specify the name and filetype of the generated artifact:
	lula generate system-security-plan -p <path/to/profile> -c <path/to/component-definition> -o my_ssp.yaml
`

var sspLong = `Generation of a System Security Plan OSCAL artifact from a source profile along with an optional list of component definitions.`

func GenerateSSPCommand() *cobra.Command {
	var (
		components []string
		profile    string
		outputFile string
		remarks    []string
	)

	sspCmd := &cobra.Command{
		Use:     "system-security-plan",
		Aliases: []string{"ssp"},
		Short:   "Generate a system security plan OSCAL artifact",
		Long:    sspLong,
		Example: sspExample,
		RunE: func(cmd *cobra.Command, args []string) error {
			message.Info("generate system-security-plan executed")

			if outputFile == "" {
				outputFile = "system-security-plan.yaml"
			}

			// Check if output file contains a valid OSCAL model
			_, err := oscal.ValidOSCALModelAtPath(outputFile)
			if err != nil {
				return fmt.Errorf("invalid OSCAL model at output: %v", err)
			}

			// Get output directory
			outputFileAbsPath, err := filepath.Abs(outputFile)
			if err != nil {
				return fmt.Errorf("error getting absolute path of output file: %v", err)
			}
			outputDirAbs := filepath.Dir(outputFileAbsPath)

			// Get profile model from file
			profileModel, modelType, err := oscal.FetchOSCALModel(profile, "")
			if err != nil {
				return err
			}
			if modelType != oscal.OSCAL_PROFILE {
				return fmt.Errorf("profile must be a valid OSCAL profile")
			}

			command := fmt.Sprintf("%s --profile %s --remarks %s", cmd.CommandPath(), profile, strings.Join(remarks, ","))

			// Get absolute path of profile
			wd, err := os.Getwd()
			if err != nil {
				return fmt.Errorf("error getting working directory: %v", err)
			}
			profileAbsPath := network.GetAbsolutePath(profile, wd)

			// Set up template data
			// TODO: incorporate overrides, more specific templating flags
			templateData, err := template.CollectTemplatingData(common.TemplateConstants, common.TemplateVariables, nil)
			if err != nil {
				return fmt.Errorf("error collecting templating data: %v", err)
			}

			// Get component definitions from file(s)
			componentDefs := make([]*oscal.ComponentDefinition, 0, len(components))
			for _, componentPath := range components {
				componentPathAbs := network.GetAbsolutePath(componentPath, wd)

				data, err := network.Fetch(componentPathAbs)
				if err != nil {
					return fmt.Errorf("error reading file: %v", err)
				}

				// Create a new component definition from the component definition file
				componentDef, err := oscal.NewComponentDefinition(
					oscal.ComponentWithTemplateData(templateData),
					oscal.ComponentWithRenderType(template.ALL),
				)
				if err != nil {
					return err
				}

				err = componentDef.NewModel(data)
				if err != nil {
					return err
				}

				// Resolve any component definition imports
				componentDirAbs := filepath.Dir(componentPathAbs)

				err = componentDef.ResolveImportComponentDefinitions(componentDirAbs)
				if err != nil {
					return err
				}

				// Rewrite paths to be relative to the outputDir
				err = componentDef.RewritePaths(componentDirAbs, outputDirAbs)
				if err != nil {
					return err
				}

				componentDefs = append(componentDefs, componentDef)
				command += fmt.Sprintf(" --components %s", componentPath)
			}

			// Generate the system security plan
			ssp, err := oscal.GenerateSystemSecurityPlan(command, profileAbsPath, outputDirAbs, remarks, profileModel.Profile, componentDefs...)
			if err != nil {
				return err
			}

			// Write the system security plan to file
			err = oscal.WriteOscalModelNew(outputFile, ssp)
			if err != nil {
				message.Fatalf(err, "error writing ssp to file: %v", err)
			}

			// Informs user that some fields in SSP need to be manually updated
			message.Warn("Some data in the SSP will need to be manually updated. Search for `TODO` items.")

			return nil
		},
	}

	sspCmd.Flags().StringVarP(&profile, "profile", "p", "", "the path to the imported profile")
	err := sspCmd.MarkFlagRequired("profile")
	if err != nil {
		message.Fatal(err, "error initializing profile command flags")
	}
	sspCmd.Flags().StringSliceVarP(&components, "components", "c", []string{}, "comma delimited list the paths to the component definitions to include for the SSP")
	sspCmd.Flags().StringSliceVar(&remarks, "remarks", []string{"statement"}, "Target for remarks population")
	sspCmd.Flags().StringVarP(&outputFile, "output-file", "o", "", "the path to the output file. If not specified, the output file will default to `system-security-plan.yaml`")

	return sspCmd
}
