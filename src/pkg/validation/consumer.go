package validation

import (
	"fmt"
	"os"
	"strings"

	"github.com/defenseunicorns/lula/src/pkg/common/oscal"
	"github.com/defenseunicorns/lula/src/pkg/message"
)

// ResultConsumer is the interface that must be implemented by any consumer of the requirements
// It is responsible for evaluating the results and generating the output speific to the consumer.
type ResultConsumer interface {
	// The GenerateResults method should take the requirements, as specified by the producer,
	// and generate the results in the consumer-specific custom format
	GenerateResults(store *RequirementStore) error
}

// AssessmentResultsConsumer is an implementation of the ResultConsumer interface
// This consumer is responsible for generating an OSCAL Assessment Results model
type AssessmentResultsConsumer struct {
	assessmentResults *oscal.AssessmentResults
	path              string
}

func NewAssessmentResultsConsumer(path string) *AssessmentResultsConsumer {
	// Get asssessment results from file
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	ar := oscal.NewAssessmentResults()

	// Update the assessment results model if data is not nil
	if len(data) != 0 {
		err = ar.NewModel(data)
		if err != nil {
			return nil
		}
	}

	return &AssessmentResultsConsumer{
		assessmentResults: ar,
		path:              path,
	}
}

func (c *AssessmentResultsConsumer) GenerateResults(store *RequirementStore) error {
	// Update the oscal.AssessmentResults with the results from the store
	// each requirement should be a finding
	// each validation in the requirement should be an observation

	// Create oscal results -> generate assessment results model (GenerateAssessmentResults)

	// If the existing assessment results are nil (c.assessmentResults == nil), set them

	// If they are populated, merge the results from the store into the existing assessment results

	return oscal.WriteOscalModelNew(c.path, c.assessmentResults)
}

// SimpleConsumer is an implementation of the ResultConsumer interface
// The consumer determines "Pass" is true iff all requirements are satisfied
// Useful for quick determination of pass/fail status of the requirements
type SimpleConsumer struct {
	pass bool
	msg  string
}

func NewSimpleConsumer() *SimpleConsumer {
	return &SimpleConsumer{
		pass: false,
	}
}

func (c *SimpleConsumer) GenerateResults(store *RequirementStore) error {
	var output strings.Builder
	requirements := store.GetRequirements()
	passCount := 0

	// Evaluate each requirement for pass/fail
	for _, requirement := range requirements {
		if requirement == nil {
			continue
		}

		pass, msg := requirement.EvaluateSuccess()
		if pass {
			passCount++
		}
		output.WriteString(msg)
	}

	if passCount > 0 && passCount == len(requirements) {
		c.pass = true
		return nil
	}

	c.msg = output.String()

	// Could have some additional logic inside SimpleConsumer to determine if output should be printed
	// to stdout, or some external file, etc.
	c.WriteOutput()

	return nil
}

func (c *SimpleConsumer) WriteOutput() error {
	if !c.pass {
		return fmt.Errorf("requirements failed: %s", c.msg)
	}
	message.Infof("Requirements passed")
	return nil
}

// // Sample extension of the Consumer interface to provide logic to a k8s controller
// // KubernetesValidationController watches ConfigRequirement resources
// type KubernetesValidationController struct {
// 	client client.Client
// }

// var _ ResultConsumer = &KubernetesValidationController{}

// // GenerateResults updates the Kubernetes resource status with validation results
// // Each CR is a requirement but could do like a whole component definition as a CR?
// func (c *KubernetesValidationController) GenerateResults(store *RequirementStore) error {
// 	requirements := store.GetRequirements()

// 	for _, req := range requirements {
// 		success, message := req.EvaluateSuccess()

// 		// Fetch the corresponding Kubernetes object
// 		var configReqtCr v1alpha1.ConfigRequirement
// 		err := c.client.Get(context.TODO(), types.NamespacedName{
// 			Name:      req.ID(),
// 			Namespace: "default",
// 		}, &configReqtCr)
// 		if err != nil {
// 			return fmt.Errorf("failed to fetch ConfigRequirement CR %s: %w", req.ID(), err)
// 		}

// 		// Update the status
// 		configReqtCr.Status.Success = success
// 		configReqtCr.Status.Message = message

// 		// Save the updated status
// 		if err := c.client.Status().Update(context.TODO(), &configReqtCr); err != nil {
// 			return fmt.Errorf("failed to update ConfigRequirement CR %s: %w", req.ID(), err)
// 		}
// 	}

// 	return nil
// }

// Reconciliation loop just calls validator.ExecuteValidations
