package tui_test

import (
	"os"
	"testing"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	oscalTypes_1_1_2 "github.com/defenseunicorns/go-oscal/src/types/oscal-1-1-2"
	"github.com/defenseunicorns/lula/src/internal/testhelpers"
	"github.com/defenseunicorns/lula/src/internal/tui"
	"github.com/defenseunicorns/lula/src/internal/tui/common"
	"github.com/muesli/termenv"
)

const (
	timeout    = time.Second * 20
	maxRetries = 3
	height     = common.DefaultHeight
	width      = common.DefaultWidth
)

func init() {
	lipgloss.SetColorProfile(termenv.Ascii)
}

// TestNewOSCALModel tests that the NewOSCALModel creates the expected model from the provided map of OSCAL models
func TestNewOSCALModel(t *testing.T) {
	tempLog := testhelpers.CreateTempFile(t, "log")
	defer os.Remove(tempLog.Name())

	oscalComponent := testhelpers.OscalFromPath(t, "../../test/unit/common/oscal/valid-component.yaml")
	oscalAssessment := testhelpers.OscalFromPath(t, "../../test/unit/common/oscal/valid-assessment-results.yaml")
	model := tui.NewOSCALModel(
		map[string]*oscalTypes_1_1_2.OscalCompleteSchema{
			"component":          oscalComponent,
			"assessment-results": oscalAssessment,
		},
		map[string]string{
			"component":          "component.yaml",
			"assessment-results": "assessment-results.yaml",
		}, tempLog)

	msgs := []tea.Msg{}

	err := testhelpers.RunTestModelView(t, model, nil, msgs, timeout, maxRetries, height, width)
	if err != nil {
		t.Fatal(err)
	}
}

// Add test for component model save?
