package tui

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	oscalTypes_1_1_2 "github.com/defenseunicorns/go-oscal/src/types/oscal-1-1-2"
	ar "github.com/defenseunicorns/lula/src/internal/tui/assessment_results"
	"github.com/defenseunicorns/lula/src/internal/tui/common"
	"github.com/defenseunicorns/lula/src/internal/tui/component"
)

type model struct {
	tabs                      []string
	activeTab                 int
	oscalModel                oscalTypes_1_1_2.OscalCompleteSchema
	componentModel            component.Model
	assessmentResultsModel    ar.Model
	catalogModel              common.TbdModal
	planOfActionAndMilestones common.TbdModal
	assessmentPlanModel       common.TbdModal
	systemSecurityPlanModel   common.TbdModal
	profileModel              common.TbdModal
	warnModel                 common.WarnModal
	width                     int
	height                    int
}

func NewOSCALModel(oscalModel oscalTypes_1_1_2.OscalCompleteSchema) model {
	// tabs := checkNonNullFields(oscalModel)
	tabs := []string{
		"ComponentDefinition",
		"AssessmentResults",
		"SystemSecurityPlan",
		"AssessmentPlan",
		"PlanOfActionAndMilestones",
		"Catalog",
		"Profile",
	}

	return model{
		tabs:                      tabs,
		oscalModel:                oscalModel,
		componentModel:            component.NewComponentDefinitionModel(oscalModel.ComponentDefinition),
		assessmentResultsModel:    ar.NewAssessmentResultsModel(oscalModel.AssessmentResults),
		systemSecurityPlanModel:   common.NewTbdModal("System Security Plan"),
		catalogModel:              common.NewTbdModal("Catalog"),
		profileModel:              common.NewTbdModal("Profile"),
		assessmentPlanModel:       common.NewTbdModal("Assessment Plan"),
		planOfActionAndMilestones: common.NewTbdModal("Plan of Action and Milestones"),
	}
}

func (m model) Init() tea.Cmd {
	return nil
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {

	case tea.KeyMsg:
		// m.handleKey(msg.String(), nil)
		switch msg.String() {
		case "tab":
			m.activeTab = (m.activeTab + 1) % len(m.tabs)
		case "shift+tab":
			if m.activeTab == 0 {
				m.activeTab = len(m.tabs) - 1
			} else {
				m.activeTab = m.activeTab - 1
			}
		case "ctrl+c":
			return m, tea.Quit
		}

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

		contentHeight := m.height - 10
		contentWidth := m.width

		// Set the height and width of the models
		m.componentModel.SetDimensions(contentWidth, contentHeight)
		m.assessmentResultsModel.SetDimensions(contentWidth, contentHeight)
	}

	var cmd tea.Cmd
	tabModel, cmd := m.loadTabModel(msg)
	if tabModel != nil {
		newTabModel, newCmd := tabModel.Update(msg)
		if newTabModel != nil {
			switch m.tabs[m.activeTab] {
			case "ComponentDefinition":
				m.componentModel = newTabModel.(component.Model)
			case "AssessmentResults":
				m.assessmentResultsModel = newTabModel.(ar.Model)
			}
		}
		cmds = append(cmds, newCmd)
	}

	cmds = append(cmds, cmd)

	return m, tea.Batch(cmds...)
}

func (m model) View() string {
	var tabs []string
	for i, t := range m.tabs {
		if i == m.activeTab {
			tabs = append(tabs, common.ActiveTab.Render(t))
		} else {
			tabs = append(tabs, common.Tab.Render(t))
		}
	}

	row := lipgloss.JoinHorizontal(lipgloss.Top, tabs...)
	gap := common.TabGap.Render(strings.Repeat(" ", max(0, m.width-lipgloss.Width(row)-2)))
	row = lipgloss.JoinHorizontal(lipgloss.Bottom, row, gap)

	tabModel, _ := m.loadTabModel(nil)
	if tabModel != nil {
		body := lipgloss.NewStyle().PaddingTop(0).PaddingLeft(2).Render(tabModel.View())
		return fmt.Sprintf("%s\n%s", row, body)
	}

	return row
}

func (m model) closeAllTabs() {
	m.catalogModel.Close()
	m.profileModel.Close()
	m.componentModel.Close()
	m.systemSecurityPlanModel.Close()
	m.assessmentPlanModel.Close()
	m.assessmentResultsModel.Close()
	m.planOfActionAndMilestones.Close()
}

func (m model) loadTabModel(msg tea.Msg) (tea.Model, tea.Cmd) {
	m.closeAllTabs()
	switch m.tabs[m.activeTab] {
	case "Catalog":
		m.catalogModel.Open()
		return m.catalogModel, nil
	case "Profile":
		m.profileModel.Open()
		return m.profileModel, nil
	case "ComponentDefinition":
		m.componentModel.Open()
		return m.componentModel, nil
	case "SystemSecurityPlan":
		m.systemSecurityPlanModel.Open()
		return m.systemSecurityPlanModel, nil
	case "AssessmentPlan":
		m.assessmentPlanModel.Open()
		return m.assessmentPlanModel, nil
	case "AssessmentResults":
		m.assessmentResultsModel.Open()
		return m.assessmentResultsModel, nil
	case "PlanOfActionAndMilestones":
		m.planOfActionAndMilestones.Open()
		return m.planOfActionAndMilestones, nil
	}
	return nil, nil
}
