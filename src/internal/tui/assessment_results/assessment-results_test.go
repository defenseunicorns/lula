package assessmentresults_test

import (
	"testing"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/defenseunicorns/lula/src/internal/testhelpers"
	assessmentresults "github.com/defenseunicorns/lula/src/internal/tui/assessment_results"
	"github.com/defenseunicorns/lula/src/internal/tui/common"
	"github.com/muesli/termenv"
)

const (
	timeout    = time.Second * 20
	maxRetries = 3
	height     = common.DefaultHeight
	width      = common.DefaultWidth

	validAssessmentResults = "../../../test/unit/common/oscal/valid-assessment-results.yaml"
)

func init() {
	lipgloss.SetColorProfile(termenv.Ascii)
}

// TestAssessmentResultsBasicView tests that the model is created correctly from an assessment results model
func TestAssessmentResultsBasicView(t *testing.T) {
	oscalModel := testhelpers.OscalFromPath(t, validAssessmentResults)
	model := assessmentresults.NewAssessmentResultsModel(oscalModel.AssessmentResults)
	model.Open(height, width)

	msgs := []tea.Msg{}

	err := testhelpers.RunTestModelView(t, model, nil, msgs, timeout, maxRetries, height, width)
	if err != nil {
		t.Fatal(err)
	}
}

func TestGetReadableDesc(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		desc     string
		expected string
	}{
		{
			name:     "Test get readable desc",
			desc:     "[TEST]: 67456ae8-4505-4c93-b341-d977d90cb125 - istio-health-check",
			expected: "istio-health-check",
		},
		{
			name:     "Test get readable desc - no uuid",
			desc:     "test description",
			expected: "test description",
		},
		{
			name:     "Test get readable desc - no description",
			desc:     "[TEST]: 12345678-1234-1234-1234-123456789012",
			expected: "[TEST]: 12345678-1234-1234-1234-123456789012",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := assessmentresults.GetReadableObservationName(tt.desc)
			if got != tt.expected {
				t.Errorf("GetReadableObservationName() got = %v, want %v", got, tt.expected)
			}
		})
	}
}
