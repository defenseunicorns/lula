package common

import (
	"github.com/charmbracelet/bubbles/key"
)

type Keys struct {
	Quit           key.Binding
	Help           key.Binding
	ModelLeft      key.Binding
	ModelRight     key.Binding
	NavigateModels key.Binding
	NavigateLeft   key.Binding
	NavigateRight  key.Binding
	Navigation     key.Binding
	Confirm        key.Binding
	Select         key.Binding
	Cancel         key.Binding
	Up             key.Binding
	Down           key.Binding
	Filter         key.Binding
	Edit           key.Binding
	Save           key.Binding
	Newline        key.Binding
}

var CommonKeys = Keys{
	Quit: key.NewBinding(
		key.WithKeys("ctrl+c"),
		key.WithHelp("ctrl+c", "quit"),
	),
	Help: key.NewBinding(
		key.WithKeys("?"),
		key.WithHelp("?", "toggle help"),
	),
	ModelRight: key.NewBinding(
		key.WithKeys("tab"),
		key.WithHelp("tab", "model right"),
	),
	ModelLeft: key.NewBinding(
		key.WithKeys("shift+tab"),
		key.WithHelp("shift+tab", "model left"),
	),
	NavigateModels: key.NewBinding(
		key.WithKeys("tab", "shift+tab"),
		key.WithHelp("tab/shift+tab", "switch models"),
	),
	Navigation: key.NewBinding(
		key.WithKeys("left", "h", "right", "l"),
		key.WithHelp("←/h, →/l", "navigation"),
	),
	NavigateLeft: key.NewBinding(
		key.WithKeys("left", "h"),
		key.WithHelp("←/h", "navigate left"),
	),
	NavigateRight: key.NewBinding(
		key.WithKeys("right", "l"),
		key.WithHelp("→/l", "navigate right"),
	),
	Confirm: key.NewBinding(
		key.WithKeys("enter"),
		key.WithHelp("↳", "confirm"),
	),
	Select: key.NewBinding(
		key.WithKeys("enter"),
		key.WithHelp("↳", "select"),
	),
	Cancel: key.NewBinding(
		key.WithKeys("esc"),
		key.WithHelp("esc", "cancel"),
	),
	Edit: key.NewBinding(
		key.WithKeys("e"),
		key.WithHelp("e", "edit"),
	),
	Save: key.NewBinding(
		key.WithKeys("ctrl+s"),
		key.WithHelp("ctrl+s", "save"),
	),
}

func ContainsKey(v string, a []string) string {
	for _, i := range a {
		if i == v {
			return v
		}
	}
	return ""
}

type listKeys struct {
	Up      key.Binding
	Down    key.Binding
	Filter  key.Binding
	Confirm key.Binding
	Select  key.Binding
	Cancel  key.Binding
	Help    key.Binding
}

var ListKeys = listKeys{
	Up: key.NewBinding(
		key.WithKeys("up", "k"),
		key.WithHelp("↑/k", "move up"),
	),
	Down: key.NewBinding(
		key.WithKeys("down", "j"),
		key.WithHelp("↓/j", "move down"),
	),
	Filter: key.NewBinding(
		key.WithKeys("/"),
		key.WithHelp("/", "filter"),
	),
	Confirm: key.NewBinding(
		key.WithKeys("enter"),
		key.WithHelp("↳", "confirm"),
	),
	Select: key.NewBinding(
		key.WithKeys("enter"),
		key.WithHelp("↳", "select"),
	),
	Cancel: key.NewBinding(
		key.WithKeys("esc"),
		key.WithHelp("esc", "cancel"),
	),
	Help: key.NewBinding(
		key.WithKeys("?"),
		key.WithHelp("?", "toggle help"),
	),
}

var (
	ShortHelpList = []key.Binding{
		ListKeys.Select, ListKeys.Up, ListKeys.Down, ListKeys.Filter, ListKeys.Help,
	}
	FullHelpListOneLine = []key.Binding{
		ListKeys.Select, ListKeys.Up, ListKeys.Down, ListKeys.Filter, ListKeys.Cancel, ListKeys.Help,
	}
	FullHelpList = [][]key.Binding{
		{ListKeys.Select}, {ListKeys.Up}, {ListKeys.Down}, {ListKeys.Filter}, {ListKeys.Cancel}, {ListKeys.Help},
	}
)

type pickerKeys struct {
	Up     key.Binding
	Down   key.Binding
	Select key.Binding
	Cancel key.Binding
}

var PickerKeys = pickerKeys{
	Up: key.NewBinding(
		key.WithKeys("up", "k"),
		key.WithHelp("↑/k", "move up"),
	),
	Down: key.NewBinding(
		key.WithKeys("down", "j"),
		key.WithHelp("↓/j", "move down"),
	),
	Select: key.NewBinding(
		key.WithKeys("enter"),
		key.WithHelp("↳", "select"),
	),
	Cancel: key.NewBinding(
		key.WithKeys("esc", "q"),
		key.WithHelp("esc/q", "cancel"),
	),
}

var (
	ShortHelpPicker = []key.Binding{
		PickerKeys.Up, PickerKeys.Down, PickerKeys.Select, PickerKeys.Cancel,
	}
	FullHelpPickerOneLine = []key.Binding{
		PickerKeys.Up, PickerKeys.Down, PickerKeys.Select, PickerKeys.Cancel,
	}
	FullHelpPicker = [][]key.Binding{
		{PickerKeys.Up}, {PickerKeys.Down}, {PickerKeys.Select}, {PickerKeys.Cancel},
	}
)

// Implemented for
type editorKeys struct {
	Confirm    key.Binding
	NewLine    key.Binding
	DeleteWord key.Binding
	Cancel     key.Binding
}

var EditKeys = editorKeys{
	Confirm: key.NewBinding(
		key.WithKeys("enter"),
		key.WithHelp("enter", "confirm"),
	),
	NewLine: key.NewBinding(
		key.WithKeys("ctrl+e"),
		key.WithHelp("ctrl+e", "new line"),
	),
	DeleteWord: key.NewBinding(
		key.WithKeys("alt+backspace"),
		key.WithHelp("alt+backspace", "delete word"),
	),
	Cancel: key.NewBinding(
		key.WithKeys("esc"),
		key.WithHelp("esc", "cancel"),
	),
}

var (
	ShortHelpEditing = []key.Binding{
		EditKeys.Confirm, EditKeys.NewLine, EditKeys.DeleteWord, EditKeys.Cancel,
	}
	FullHelpEditingOneLine = []key.Binding{
		EditKeys.Confirm, EditKeys.NewLine, EditKeys.DeleteWord, EditKeys.Cancel,
	}
	FullHelpEditing = [][]key.Binding{
		{EditKeys.Confirm}, {EditKeys.NewLine}, {EditKeys.DeleteWord}, {EditKeys.Cancel},
	}
)
