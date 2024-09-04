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
	Navigation     key.Binding
	NavigateLeft   key.Binding
	NavigateRight  key.Binding
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
	Newline: key.NewBinding(
		key.WithKeys("ctrl+e"),
		key.WithHelp("ctrl+e", "new line"),
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
	Slash   key.Binding
	Confirm key.Binding
	Select  key.Binding
	Escape  key.Binding
	Help    key.Binding
}

var ListHotkeys = listKeys{
	Up: key.NewBinding(
		key.WithKeys("up", "k"),
		key.WithHelp("↑/k", "move up"),
	),
	Down: key.NewBinding(
		key.WithKeys("down", "j"),
		key.WithHelp("↓/j", "move down"),
	),
	Slash: key.NewBinding(
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
	Escape: key.NewBinding(
		key.WithKeys("esc"),
		key.WithHelp("esc", "cancel"),
	),
	Help: key.NewBinding(
		key.WithKeys("?"),
		key.WithHelp("?", "toggle help"),
	),
}

func (k listKeys) ShortHelp() []key.Binding {
	return []key.Binding{k.Up, k.Down, k.Help}
}

func (k listKeys) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{k.Up, k.Down}, {k.Slash, k.Confirm}, {k.Escape, k.Help},
	}
}

type pickerKeys struct {
	Up      key.Binding
	Down    key.Binding
	Confirm key.Binding
	Cancel  key.Binding
}

var PickerHotkeys = pickerKeys{
	Up: key.NewBinding(
		key.WithKeys("up", "k"),
		key.WithHelp("↑/k", "move up"),
	),
	Down: key.NewBinding(
		key.WithKeys("down", "j"),
		key.WithHelp("↓/j", "move down"),
	),
	Confirm: key.NewBinding(
		key.WithKeys("enter"),
		key.WithHelp("↳", "select"),
	),
	Cancel: key.NewBinding(
		key.WithKeys("esc", "q"),
		key.WithHelp("esc/q", "cancel"),
	),
}

func (k pickerKeys) ShortHelp() []key.Binding {
	return []key.Binding{k.Up, k.Down, k.Confirm, k.Cancel}
}

func (k pickerKeys) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{k.Up}, {k.Down}, {k.Confirm}, {k.Cancel},
	}
}

// Implemented for
type editorKeys struct {
	Confirm key.Binding
	NewLine key.Binding
	Save    key.Binding
	Cancel  key.Binding
}

var EditHotkeys = editorKeys{
	Confirm: key.NewBinding(
		key.WithKeys("enter"),
		key.WithHelp("enter", "confirm"),
	),
	NewLine: key.NewBinding(
		key.WithKeys("ctrl+e"),
		key.WithHelp("ctrl+e", "new line"),
	),
	Save: key.NewBinding(
		key.WithKeys("ctrl+s"),
		key.WithHelp("ctrl+s", "save"),
	),
	Cancel: key.NewBinding(
		key.WithKeys("esc"),
		key.WithHelp("esc", "cancel"),
	),
}

func (k editorKeys) ShortHelp() []key.Binding {
	return []key.Binding{k.Confirm, k.NewLine, k.Save, k.Cancel}
}

func (k editorKeys) SingleLineFullHelp() []key.Binding {
	return []key.Binding{k.Confirm, k.NewLine, k.Save, k.Cancel}
}

func (k editorKeys) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{k.Confirm}, {k.NewLine}, {k.Confirm}, {k.Cancel},
	}
}
