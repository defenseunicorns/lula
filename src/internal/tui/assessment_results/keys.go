package assessmentresults

import (
	"github.com/charmbracelet/bubbles/key"
	"github.com/defenseunicorns/lula/src/internal/tui/common"
)

type keys struct {
	Validate      key.Binding
	Evaluate      key.Binding
	Confirm       key.Binding
	Cancel        key.Binding
	Navigation    key.Binding
	NavigateLeft  key.Binding
	NavigateRight key.Binding
	SwitchModels  key.Binding
	Detail        key.Binding
	Filter        key.Binding
	Up            key.Binding
	Down          key.Binding
	Help          key.Binding
	Quit          key.Binding
}

var assessmentKeys = keys{
	Quit:          common.CommonKeys.Quit,
	Help:          common.CommonKeys.Help,
	Confirm:       common.CommonKeys.Confirm,
	Cancel:        common.CommonKeys.Cancel,
	Navigation:    common.CommonKeys.Navigation,
	NavigateLeft:  common.CommonKeys.NavigateLeft,
	NavigateRight: common.CommonKeys.NavigateRight,
	SwitchModels:  common.CommonKeys.NavigateModels,
	Up:            common.PickerKeys.Up,
	Down:          common.PickerKeys.Down,
	Detail:        common.CommonKeys.Detail,
}

var (
	// No focus
	shortHelpNoFocus = []key.Binding{
		assessmentKeys.Navigation, assessmentKeys.SwitchModels, assessmentKeys.Help,
	}
	fullHelpNoFocusOneLine = []key.Binding{
		assessmentKeys.Navigation, assessmentKeys.SwitchModels, assessmentKeys.Help,
	}
	fullHelpNoFocus = [][]key.Binding{
		{assessmentKeys.Navigation}, {assessmentKeys.SwitchModels}, {assessmentKeys.Help},
	}
)
