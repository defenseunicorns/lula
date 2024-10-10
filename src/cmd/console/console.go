package console

import (
	"fmt"
	"os"

	oscalTypes_1_1_2 "github.com/defenseunicorns/go-oscal/src/types/oscal-1-1-2"
	"github.com/defenseunicorns/lula/src/internal/tui"
	"github.com/defenseunicorns/lula/src/pkg/common/oscal"
	"github.com/defenseunicorns/lula/src/pkg/message"
	"github.com/spf13/cobra"

	tea "github.com/charmbracelet/bubbletea"
)

var consoleHelp = `
To view an OSCAL model in the Console:
	lula console -f /path/to/oscal-component.yaml
`

var consoleLong = `
The Lula Console is a text-based terminal user interface that allows users to 
interact with the OSCAL documents in a more intuitive and visual way.
`

func ConsoleCommand() *cobra.Command {
	var inputFiles []string

	consoleCmd := &cobra.Command{
		Use:     "console",
		Aliases: []string{"ui"},
		Short:   "Console terminal user interface for OSCAL models",
		Long:    consoleLong,
		Example: consoleHelp,
		RunE: func(cmd *cobra.Command, args []string) error {
			models, modelFiles, err := GetModelsByFiles(inputFiles)
			if err != nil {
				return err
			}

			// TODO: need to integrate with the log file handled by messages
			var dumpFile *os.File
			if message.GetLogLevel() == message.DebugLevel {
				dumpFile, err = os.OpenFile("debug.log", os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o644)
				if err != nil {
					return err
				}
				defer dumpFile.Close()
			}

			p := tea.NewProgram(tui.NewOSCALModel(models, modelFiles, dumpFile), tea.WithAltScreen(), tea.WithMouseCellMotion())

			if _, err := p.Run(); err != nil {
				return err
			}

			return nil
		},
	}

	consoleCmd.Flags().StringSliceVarP(&inputFiles, "input-files", "f", []string{}, "the path to the target OSCAL models, comma separated")
	consoleCmd.MarkFlagRequired("input-files")
	return consoleCmd
}

func GetModelsByFiles(inputFiles []string) (map[string]*oscalTypes_1_1_2.OscalModels, map[string]string, error) {
	var models = make(map[string]*oscalTypes_1_1_2.OscalModels)
	var modelFiles = make(map[string]string)

	// Get the OSCAL models from the files
	for _, inputFile := range inputFiles {
		data, err := os.ReadFile(inputFile)
		if err != nil {
			return nil, nil, fmt.Errorf("error reading file: %v", err)
		}
		oscalModel, err := oscal.NewOscalModel(data)
		if err != nil {
			return nil, nil, fmt.Errorf("error creating oscal model from file: %v", err)
		}

		// Assign the model type
		modelType, err := oscal.GetOscalModel(oscalModel)
		if err != nil {
			return nil, nil, fmt.Errorf("error getting oscal model type from file %s: %v", inputFile, err)
		}

		// Add the model to the map
		if _, ok := models[modelType]; ok {
			// try to merge the models
			newModel, err := oscal.MergeOscalModels(models[modelType], oscalModel, modelType)
			if err != nil {
				return nil, nil, fmt.Errorf("error merging oscal models: %v", err)
			}
			models[modelType] = newModel

			// get new default output filename
			modelFiles[modelType] = fmt.Sprintf("%s.yaml", modelType)
		} else {
			models[modelType] = oscalModel
			modelFiles[modelType] = inputFile
		}
	}

	return models, modelFiles, nil
}
