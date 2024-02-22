package tools

import (
	"fmt"
	"os"
	"strings"
	"text/template"

	"github.com/defenseunicorns/lula/src/config"
	"github.com/defenseunicorns/lula/src/pkg/message"
	"github.com/spf13/cobra"
)

var regoHelp = `
To create a new template for Rego Validation:
	lula tools regogen

To create a template given some resource kind:
	lula tools regogen Deployment
`

var regoTemplate = `
package validate
import data.common

result := get_allowances(input.{{ . | lower }}s)

get_allowances(resources) = result {
  valid := [name | resource := resources[_]; allowed(resource); name := common.print_resource(resource)]
  invalid := [name | resource := resources[_]; not allowed(resource); name := common.print_resource(resource)]
  result := {"passed": valid, "failed": invalid, "validate": count(invalid) == 0}
}

allowed(resource) {
  resource.kind == "{{ . }}"
  allowed_{{ . | lower }}(resource)
}

allowed_{{ . | lower }}({{ . | lower }}) {
  # ** Change this **
  # Logic for allowed {{ . }} instance
  # example: {{ . | lower }}.metadata.namespace != "default"
}

allowed_{{ . | lower }}({{ . | lower }}) {
  # Exempted {{ . }} instances by "<namespace>/<name>", regex supported
  exempt := {} # example: {"istio-system/.*"} ** Change this **
  common.exempted(exempt, {{ . | lower }})
}
`

func init() {
	// Kubectl stub command.
	uuidCmd := &cobra.Command{
		Use:   "regogen",
		Short: "Generate a Rego Template for Validation",
		PersistentPreRun: func(cmd *cobra.Command, args []string) {
			config.SkipLogFile = true
		},
		Long:    "Generate a Rego Template for the Lula Validation backmatter in an OSCAL document",
		Example: regoHelp,
		Run: func(cmd *cobra.Command, args []string) {
			funcMap := template.FuncMap{
				"lower": strings.ToLower,
			}
			tmpl, err := template.New("rego").Funcs(funcMap).Parse(regoTemplate)
			if err != nil {
				panic(err)
			}

			if len(args) == 0 {
				err = tmpl.Execute(os.Stdout, "Resource")
				if err != nil {
					panic(err)
				}
			} else if len(args) == 1 {
				err = tmpl.Execute(os.Stdout, args[0])
				if err != nil {
					panic(err)
				}
			} else {
				message.Fatal(fmt.Errorf("Too many arguments"), "Too many arguments")
			}
		},
	}

	toolsCmd.AddCommand(uuidCmd)
}
