package test

import (
	"testing"

	"github.com/defenseunicorns/lula/src/cmd/validate"
)

func TestFileValidation(t *testing.T) {
	t.Run("basic success - opa", func(t *testing.T) {
		oscalPath := "./scenarios/file-validations/component-definition.yaml"

		assessment, err := validate.ValidateOnPath(oscalPath, "")
		if err != nil {
			t.Fatal(err)
		}

		if len(assessment.Results) == 0 {
			t.Fatal("Expected greater than zero results")
		}

		result := assessment.Results[0]

		if result.Findings == nil {
			t.Fatal("Expected findings to be not nil")
		}

		for _, finding := range *result.Findings {
			state := finding.Target.Status.State
			if state != "satisfied" {
				t.Fatal("State should be satisfied, but got :", state)
			}
		}

	})
}
