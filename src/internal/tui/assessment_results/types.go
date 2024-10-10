package assessmentresults

import (
	"github.com/charmbracelet/bubbles/viewport"
	oscalTypes_1_1_2 "github.com/defenseunicorns/go-oscal/src/types/oscal-1-1-2"
	"github.com/defenseunicorns/lula/src/internal/tui/common"
	"github.com/evertras/bubble-table/table"
)

type Model struct {
	open                  bool
	help                  common.HelpModel
	keys                  keys
	focus                 focus
	results               []result
	resultsPicker         common.PickerModel
	selectedResult        result
	comparedResultsPicker common.PickerModel
	comparedResult        result
	findingsSummary       viewport.Model
	findingsTable         table.Model
	observationsSummary   viewport.Model
	observationsTable     table.Model
	detailView            common.DetailModel
	width                 int
	height                int
}

type focus int

const (
	noFocus focus = iota
	focusResultSelection
	focusCompareSelection
	focusFindings
	focusObservations
)

var maxFocus = focusObservations

type result struct {
	uuid, title      string
	timestamp        string
	oscalResult      *oscalTypes_1_1_2.Result
	findings         *[]oscalTypes_1_1_2.Finding
	observations     *[]oscalTypes_1_1_2.Observation
	findingsRows     []table.Row
	observationsRows []table.Row
	observationsMap  map[string]table.Row
	summaryData      summaryData
}

type summaryData struct {
	numFindings, numObservations int
	numFindingsSatisfied         int
	numObservationsSatisfied     int
}

func (m *Model) Close() {
	m.open = false
}

func (m *Model) Open(height, width int) {
	m.open = true
	m.UpdateSizing(height, width)
}

func (m *Model) UpdateSizing(height, width int) {
	m.height = height
	m.width = width
	totalHeight := m.height

	topSectionHeight := common.HelpStyle(m.width).GetHeight() + common.DialogBoxStyle.GetHeight()
	bottomSectionHeight := totalHeight - topSectionHeight - 2 // 2 for summary height
	bottomPanelHeight := (bottomSectionHeight - 2*common.PanelTitleStyle.GetHeight() - 2*common.PanelTitleStyle.GetVerticalMargins()) / 2
	panelWidth := width - 4
	panelInternalWidth := panelWidth - common.PanelStyle.GetHorizontalPadding() - common.PanelStyle.GetHorizontalMargins() - 2

	// Update widget dimensions
	m.findingsSummary.Height = bottomPanelHeight
	m.findingsSummary.Width = panelWidth
	findingsRowHeight := bottomPanelHeight - common.PanelTitleStyle.GetHeight() - common.PanelStyle.GetVerticalPadding() - 6
	m.findingsTable = m.findingsTable.WithTargetWidth(panelInternalWidth).WithPageSize(findingsRowHeight)
	m.observationsSummary.Height = bottomPanelHeight
	m.observationsSummary.Width = panelWidth
	observationsRowHeight := bottomPanelHeight - common.PanelTitleStyle.GetHeight() - common.PanelStyle.GetVerticalPadding() - 6
	m.observationsTable = m.observationsTable.WithTargetWidth(panelInternalWidth).WithPageSize(observationsRowHeight)
}

func (m *Model) GetDimensions() (height, width int) {
	return m.height, m.width
}

func (m *Model) updateKeyBindings() {
	m.outOfFocus()
	m.updateFocusHelpKeys()

	switch m.focus {
	case focusFindings:
		m.findingsTable = m.findingsTable.WithKeyMap(common.FocusedTableKeyMap())
		m.findingsTable = m.findingsTable.Focused(true)
	case focusObservations:
		m.observationsTable = m.observationsTable.WithKeyMap(common.FocusedTableKeyMap())
		m.observationsTable = m.observationsTable.Focused(true)
	}
}

func (m *Model) outOfFocus() {
	focusMinusOne := m.focus - 1
	focusPlusOne := m.focus + 1

	if m.focus == 0 {
		focusMinusOne = maxFocus
	}
	if m.focus == maxFocus {
		focusPlusOne = 0
	}

	for _, f := range []focus{focusMinusOne, focusPlusOne} {
		switch f {
		case focusFindings:
			m.findingsTable = m.findingsTable.WithKeyMap(common.UnfocusedTableKeyMap())
			m.findingsTable = m.findingsTable.Focused(false)
		case focusObservations:
			m.observationsTable = m.observationsTable.WithKeyMap(common.UnfocusedTableKeyMap())
			m.observationsTable = m.observationsTable.Focused(false)
		}
	}
}

func (m *Model) updateFocusHelpKeys() {
	switch m.focus {
	case focusFindings:
		m.help.ShortHelp = common.ShortHelpTable
		m.help.FullHelpOneLine = common.FullHelpTableOneLine
		m.help.FullHelp = common.FullHelpTable
	case focusObservations:
		m.help.ShortHelp = common.ShortHelpTable
		m.help.FullHelpOneLine = common.FullHelpTableOneLine
		m.help.FullHelp = common.FullHelpTable
	default:
		m.help.ShortHelp = shortHelpNoFocus
		m.help.FullHelpOneLine = fullHelpNoFocusOneLine
		m.help.FullHelp = fullHelpNoFocus
	}
}
