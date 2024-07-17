package evaluate

import (
	"fmt"

	"github.com/defenseunicorns/go-oscal/src/pkg/files"
	oscalTypes_1_1_2 "github.com/defenseunicorns/go-oscal/src/types/oscal-1-1-2"
	"github.com/defenseunicorns/lula/src/pkg/common"
	"github.com/defenseunicorns/lula/src/pkg/common/oscal"
	"github.com/defenseunicorns/lula/src/pkg/common/result"
	"github.com/defenseunicorns/lula/src/pkg/message"
	"github.com/spf13/cobra"
)

var evaluateHelp = `
To evaluate the latest results in two assessment results files:
	lula evaluate -f assessment-results-threshold.yaml -f assessment-results-new.yaml

To evaluate two results (threshold and latest) in a single OSCAL file:
	lula evaluate -f assessment-results.yaml
`

type flags struct {
	files   []string
	summary bool
}

var opts = &flags{}

var evaluateCmd = &cobra.Command{
	Use:     "evaluate",
	Short:   "evaluate two results of a Security Assessment Results",
	Long:    "Lula evaluation of Security Assessment Results",
	Example: evaluateHelp,
	Aliases: []string{"eval"},
	Run: func(cmd *cobra.Command, args []string) {

		// Build map of filepath -> assessment results
		assessmentMap, err := readManyAssessmentResults(opts.files)
		if err != nil {
			message.Fatal(err, err.Error())
		}

		EvaluateAssessments(assessmentMap, opts.summary)
	},
}

func EvaluateCommand() *cobra.Command {

	evaluateCmd.Flags().StringArrayVarP(&opts.files, "file", "f", []string{}, "Path to the file to be evaluated")
	evaluateCmd.Flags().BoolVarP(&opts.summary, "summary", "s", false, "Print a summary of the evaluation")
	// insert flag options here
	return evaluateCmd
}

func EvaluateAssessments(assessmentMap map[string]*oscalTypes_1_1_2.AssessmentResults, summary bool) {
	// Identify the threshold & latest for comparison
	resultMap, err := oscal.IdentifyResults(assessmentMap)
	if err != nil {
		if err.Error() == "less than 2 results found - no comparison possible" {
			// Catch and warn of insufficient results
			message.Warn(err.Error())
			if len(resultMap) > 0 {
				// Indicates that there is at least one assessment result
				oscal.UpdateProps("threshold", "https://docs.lula.dev/ns", "true", resultMap["threshold"].Props)
			} else {
				return
			}
		} else {
			message.Fatal(err, err.Error())
		}
	}

	if resultMap["threshold"] != nil && resultMap["latest"] != nil {
		// Compare the assessment results
		spinner := message.NewProgressSpinner("Evaluating Assessment Results %s against %s", resultMap["threshold"].UUID, resultMap["latest"].UUID)
		defer spinner.Stop()

		message.Debugf("threshold UUID: %s / latest UUID: %s", resultMap["threshold"].UUID, resultMap["latest"].UUID)

		status, resultComparison, err := oscal.EvaluateResults(resultMap["threshold"], resultMap["latest"])
		if err != nil {
			message.Fatal(err, err.Error())
		}

		// Check 'status' - Result if evaluation is passing or failing
		// Fails if anything went from satisfied -> not-satisfied OR if any old findings are removed (doesn't matter whether they were satisfied or not)
		if status {
			// Print new-passing-findings
			newPassing := resultComparison["new-passing-findings"]
			if len(newPassing) > 0 {
				message.Info("New passing finding Target-Ids:")
				for id := range newPassing {
					message.Infof("%s", id)
				}

				message.Infof("New threshold identified - threshold will be updated to result %s", resultMap["latest"].UUID)

				// Update latest threshold prop
				oscal.UpdateProps("threshold", "https://docs.lula.dev/ns", "true", resultMap["latest"].Props)
				oscal.UpdateProps("threshold", "https://docs.lula.dev/ns", "false", resultMap["threshold"].Props)
			} else {
				// retain result as threshold
				oscal.UpdateProps("threshold", "https://docs.lula.dev/ns", "true", resultMap["threshold"].Props)
			}

			// Print new-failing-findings
			newFailing := resultComparison["new-failing-findings"]
			if len(newFailing) > 0 {
				message.Info("New failing finding Target-Ids:")
				for id := range newFailing {
					message.Infof("%s", id)
				}
			}

			// Print summary
			if summary {
				message.Info("Summary of Evaluation:")
				result.Collapse(resultComparison).PrintObservationComparisonTable(false)
			}

			message.Info("Evaluation Passed Successfully")
		} else {
			// Print no-longer-satisfied
			message.Warn("Evaluation Failed against the following findings:")
			// failedFindings := map[string]result.ResultComparisonMap{}
			// failedFindings.PrintResultComparisonTable(true)

			noLongerSatisfied := resultComparison["no-longer-satisfied"]
			for id, rc := range noLongerSatisfied {
				message.Infof("%s", id)
				rc.PrintResultComparisonTable(true)
			}

			// Print removed findings
			removedSatisfied := resultComparison["satified-removed"]
			for id, rc := range removedSatisfied {
				message.Infof("%s", id)
				rc.PrintResultComparisonTable(true)
			}
			removedNotSatisfied := resultComparison["not-satified-removed"]
			for id, rc := range removedNotSatisfied {
				message.Infof("%s", id)
				rc.PrintResultComparisonTable(true)
			}

			// Print summary
			if summary {
				message.Info("Summary of Evaluation:")
				result.Collapse(resultComparison).PrintObservationComparisonTable(false)
			}

			message.Fatalf(fmt.Errorf("failed to meet established threshold"), "failed to meet established threshold")

			// retain result as threshold
			oscal.UpdateProps("threshold", "https://docs.lula.dev/ns", "true", resultMap["threshold"].Props)
		}

		spinner.Success()

	} else if resultMap["threshold"] == nil {
		message.Fatal(fmt.Errorf("no threshold assessment results could be identified"), "no threshold assessment results could be identified")
	}

	// Write each file back in the case of modification
	for filePath, assessment := range assessmentMap {
		model := oscalTypes_1_1_2.OscalCompleteSchema{
			AssessmentResults: assessment,
		}

		oscal.WriteOscalModel(filePath, &model)
	}
}

// Read many filepaths into a map[filepath]*AssessmentResults
// Placing here until otherwise decided on value elsewhere
func readManyAssessmentResults(fileArray []string) (map[string]*oscalTypes_1_1_2.AssessmentResults, error) {
	if len(fileArray) == 0 {
		return nil, fmt.Errorf("no files provided for evaluation")
	}

	assessmentMap := make(map[string]*oscalTypes_1_1_2.AssessmentResults)
	for _, fileString := range fileArray {
		err := files.IsJsonOrYaml(fileString)
		if err != nil {
			return nil, fmt.Errorf("invalid file extension: %s, requires .json or .yaml", fileString)
		}

		data, err := common.ReadFileToBytes(fileString)
		if err != nil {
			return nil, err
		}
		assessment, err := oscal.NewAssessmentResults(data)
		if err != nil {
			return nil, err
		}
		assessmentMap[fileString] = assessment
	}

	return assessmentMap, nil
}
