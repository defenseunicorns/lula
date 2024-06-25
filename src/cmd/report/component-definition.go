package report

import (
	"errors"
	"fmt"
	"os"
	"encoding/json"

	oscalTypes_1_1_2 "github.com/defenseunicorns/go-oscal/src/types/oscal-1-1-2"
	"github.com/defenseunicorns/lula/src/pkg/message"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
)

type flags struct {
	InputFile      string // -f --input-file
	Summary        bool // -s --summary
	Detailed	   bool // -d --detailed
	OutputFormat   string // -o --output-format
	OutputFile     string // -w --output-file
	// OutputFormat string // -fmt --format									<---- Possible flag option

	// WriteFile   string // -w --write-file                                <---- Possible flag option
	// OutputFile   string // -o --output-file                              <---- Possible flag option
}

var opts = &flags{}

type ReportData struct {
    Detailed   *DetailedReportData `json:"Detailed,omitempty" yaml:"Detailed,omitempty"`
    Summary    *SummaryReportData  `json:"Summary,omitempty" yaml:"Summary,omitempty"`
}

type DetailedReportData struct {
    ControlIDCounts map[string]int
    // other detailed specific data fields
}

type SummaryReportData struct {
    // other summary specific data fields
}

var componentDefinitionHelp = `
To create a summary report of a component-definition:
	lula report component-definition -f ./oscal-component.yaml -s

To create a detailed report of a component-definition:
	lula report component-definition -f ./oscal-component.yaml -d
`
func init() {
	componentDefinitionCmd := &cobra.Command{
	Use:     "component-definition",
	Short:   "Report on an OSCAL component definition",
	Long:    "Detailed or Summary report of an OSCAL component definition",
	Example: componentDefinitionHelp,
	Run: func(cmd *cobra.Command, args []string) {
		if opts.InputFile == "" {
			message.Fatal(errors.New("flag input-file is not set"),
				"Please specify an input file with the -f flag")
		}

		oscalModels, err := loadComponentDefinitionFromFile(opts.InputFile)
		if err != nil {
			message.Fatal(err, "Failed to unmarshall OSCAL from Component Definition")
		}

		var reportData ReportData

		if opts.Detailed {
			fmt.Println("Generating detailed report in", opts.OutputFormat)
			reportData.Detailed = countControlIDs(oscalModels)
			fmt.Println("Control IDs count is:", reportData.Detailed.ControlIDCounts)

		}

		if opts.Summary {
			fmt.Println("Generating summary report in", opts.OutputFormat)
			// Add Reporting Logic
		}

		// Always print to stdout
		err = PrintReport(reportData, opts.OutputFormat)
		if err != nil {
			message.Fatal(err, "Failed to print report")
		}

		if opts.OutputFile != "" && (reportData.Detailed != nil || reportData.Summary != nil) {
        err = WriteReport(reportData, opts.OutputFile, opts.OutputFormat)
        if err != nil {
            message.Fatal(err, "Failed to write report to file")
        }
        fmt.Println("Report successfully written to", opts.OutputFile)
    }

	},
}
	reportCmd.AddCommand(componentDefinitionCmd)

	componentDefinitionCmd.Flags().StringVarP(&opts.InputFile, "input-file", "f", "", "the path to the target OSCAL component definition")
	componentDefinitionCmd.Flags().StringVarP(&opts.OutputFormat, "output-format", "o", "json", "the output format of the report")
	componentDefinitionCmd.Flags().StringVarP(&opts.OutputFile, "output-file", "w", "", "the output file path for the report")
	componentDefinitionCmd.Flags().BoolVarP(&opts.Detailed, "detailed", "d", false, "create the detailed component definition report")
	componentDefinitionCmd.Flags().BoolVarP(&opts.Summary, "summary", "s", false, "create the summary component definition report")

}

func loadComponentDefinitionFromFile(filename string) (oscalTypes_1_1_2.OscalModels, error) {
    var oscalModels oscalTypes_1_1_2.OscalModels

    // Read the YAML file using os.ReadFile
    yamlData, err := os.ReadFile(filename)
    if err != nil {
        return oscalModels, err
    }

    // Unmarshal the YAML into the oscalModels struct
    err = yaml.Unmarshal(yamlData, &oscalModels)
    if err != nil {
        return oscalModels, err
    }

    return oscalModels, nil
}


func countControlIDs(oscalModels oscalTypes_1_1_2.OscalModels) *DetailedReportData {
    controlIDCounts := make(map[string]int)
    if oscalModels.ComponentDefinition != nil && oscalModels.ComponentDefinition.Components != nil {
        for _, component := range *oscalModels.ComponentDefinition.Components {
            if component.ControlImplementations != nil {
                for _, controlImpl := range *component.ControlImplementations {
                    for _, implementedReq := range controlImpl.ImplementedRequirements {
                        controlID := implementedReq.ControlId
                        controlIDCounts[controlID]++
                    }
                }
            }
        }
    }
    return &DetailedReportData{ControlIDCounts: controlIDCounts}
}

func WriteReport(data ReportData, filePath string, format string) error {
    var err error
    var fileData []byte

    // Determine the format
    if format == "yaml" {
        fileData, err = yaml.Marshal(data)
        if err != nil {
            return fmt.Errorf("failed to marshal data to YAML: %v", err)
        }
    } else { // default to JSON if not explicitly set to "yaml"
        fileData, err = json.MarshalIndent(data, "", "  ")
        if err != nil {
            return fmt.Errorf("failed to marshal data to JSON: %v", err)
        }
    }

    // Write the serialized data to the file
    err = os.WriteFile(filePath, fileData, 0644)
    if err != nil {
        return fmt.Errorf("failed to write file: %v", err)
    }

    return nil
}

func PrintReport(data ReportData, format string) error {
    var err error
    var fileData []byte

    // Determine the format
    if format == "yaml" {
        fileData, err = yaml.Marshal(data)
        if err != nil {
            return fmt.Errorf("failed to marshal data to YAML: %v", err)
        }
    } else { // default to JSON if not explicitly set to "yaml"
        fileData, err = json.MarshalIndent(data, "", "  ")
        if err != nil {
            return fmt.Errorf("failed to marshal data to JSON: %v", err)
        }
    }

    // Write the serialized data to the file
    fmt.Println(string(fileData))

    return nil
}
