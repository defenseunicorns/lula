package oscal

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	oscalTypes "github.com/defenseunicorns/go-oscal/src/types/oscal-1-1-3"

	"github.com/defenseunicorns/lula/src/pkg/common"
)

const (
	LULA_NAMESPACE = "https://docs.lula.dev/oscal/ns"
	LULA_KEYWORD   = "lula"
)

// Update legacy_namespaces when namespace URL (LULA_NAMESPACE) changes to ensure backwards compatibility
var legacy_namespaces = []string{"https://docs.lula.dev/ns"}

// UpdateProps updates a property in a slice of properties or adds if not exists
func UpdateProps(name string, namespace string, value string, props *[]oscalTypes.Property) {

	for index, prop := range *props {
		found, propNamespace := checkOrUpdateNamespace(prop.Ns, namespace)
		if prop.Name == name && found {
			prop.Value = value
			prop.Ns = propNamespace
			(*props)[index] = prop
			return
		}
	}
	// Prop does not exist
	prop := oscalTypes.Property{
		Ns:    namespace,
		Name:  name,
		Value: value,
	}

	*props = append(*props, prop)
}

func GetProp(name string, namespace string, props *[]oscalTypes.Property) (bool, string) {

	if props == nil {
		return false, ""
	}

	for _, prop := range *props {
		found, _ := checkOrUpdateNamespace(prop.Ns, namespace)
		if prop.Name == name && found {
			return true, prop.Value
		}
	}
	return false, ""
}

func checkOrUpdateNamespace(propNamespace, namespace string) (bool, string) {
	// if namespace doesn't contain lula, check namespace == propNamespace
	if !strings.Contains(propNamespace, LULA_KEYWORD) {
		return namespace == propNamespace, propNamespace
	}

	for _, ns := range legacy_namespaces {
		if namespace == ns {
			return true, LULA_NAMESPACE
		}
	}
	return namespace == LULA_NAMESPACE, LULA_NAMESPACE
}

// CompareControls compares two control titles, handling both XX-##.## formats and regular strings.
// true sorts a before b; false sorts b before a
func CompareControls(a, b string) bool {
	// Define a regex to match the XX-##.## format
	nistFormat := regexp.MustCompile(`(?i)^[a-z]{2}-\d+(\.\d+)?$`)

	// Check if both strings match the XX-##.## format
	isANistFormat := nistFormat.MatchString(a)
	isBNistFormat := nistFormat.MatchString(b)

	// If both are in XX-##.## format, apply the custom comparison logic
	if isANistFormat && isBNistFormat {
		return compareNistFormat(a, b)
	}

	// If neither are in XX-##.## format, use simple lexicographical comparison
	if !isANistFormat && !isBNistFormat {
		return a < b
	}

	// If only one is in XX-##.## format, treat it as "less than" the regular string
	return !isANistFormat
}

// CompareControlsInt compares two controls by their title, handling both XX-##.## formats and regular strings.
// returns -1 if a < b, 0 if a == b, and 1 if a > b
// TODO: add tests for this function
func CompareControlsInt(a, b string) int {
	// Define a regex to match the XX-##.## format
	nistFormat := regexp.MustCompile(`(?i)^[a-z]{2}-\d+(\.\d+)?$`)

	// Check if both strings match the XX-##.## format
	isANistFormat := nistFormat.MatchString(a)
	isBNistFormat := nistFormat.MatchString(b)

	// If both are in XX-##.## format, apply the custom comparison logic
	if isANistFormat && isBNistFormat {
		if compareNistFormat(a, b) {
			return -1
		} else {
			return 1
		}
	}

	// If neither are in XX-##.## format, use simple lexicographical comparison
	if !isANistFormat && !isBNistFormat {
		return strings.Compare(a, b)
	}

	// If only one is in XX-##.## format, treat it as "less than" the regular string
	if isANistFormat {
		return -1
	}
	return 1
}

// compareNistFormat handles the comparison for strings in the XX-##.## format.
func compareNistFormat(a, b string) bool {
	// Split the strings by "-"
	splitA := strings.Split(a, "-")
	splitB := strings.Split(b, "-")

	// Compare the alphabetic part first
	if splitA[0] != splitB[0] {
		return splitA[0] < splitB[0]
	}

	// Compare the numeric part before the dot (.)
	numA, _ := strconv.Atoi(strings.Split(splitA[1], ".")[0])
	numB, _ := strconv.Atoi(strings.Split(splitB[1], ".")[0])

	if numA != numB {
		return numA < numB
	}

	// Compare the numeric part after the dot (.) if exists
	if len(strings.Split(splitA[1], ".")) > 1 && len(strings.Split(splitB[1], ".")) > 1 {
		subNumA, _ := strconv.Atoi(strings.Split(splitA[1], ".")[1])
		subNumB, _ := strconv.Atoi(strings.Split(splitB[1], ".")[1])
		return subNumA < subNumB
	}

	// Handle cases where only one has a sub-number
	if len(strings.Split(splitA[1], ".")) > 1 {
		return false
	}
	if len(strings.Split(splitB[1], ".")) > 1 {
		return true
	}

	return false
}

// RewritePathsBackMatter rewrites the paths found in oscalTypes.BackMatter (originally relative to baseDir) to be relative to newDir
func RewritePathsBackMatter(backMatter *oscalTypes.BackMatter, baseDir string, newDir string) (err error) {
	if backMatter == nil {
		return nil
	}

	// BackMatter.Resources.Rlinks.Href
	if backMatter.Resources != nil {
		for _, resource := range *backMatter.Resources {
			if resource.Rlinks != nil {
				for i, rlink := range *resource.Rlinks {
					rlink.Href, err = common.RemapPath(rlink.Href, baseDir, newDir)
					if err != nil {
						return fmt.Errorf("error remapping path %s: %v", rlink.Href, err)
					}
					(*resource.Rlinks)[i] = rlink
				}
			}
		}
	}

	return nil
}

// RewritePathsMetadata rewrites the paths found in oscalTypes.Metadata (originally relative to baseDir) to be relative to newDir
func RewritePathsMetadata(metadata *oscalTypes.Metadata, baseDir string, newDir string) (err error) {
	if metadata == nil {
		return nil
	}

	// Metadata.Links.Href
	if metadata.Links != nil {
		err = RewritePathsLinks(metadata.Links, baseDir, newDir)
		if err != nil {
			return err
		}
	}

	// Metadata.Revisions.Links.Href
	if metadata.Revisions != nil {
		for _, revision := range *metadata.Revisions {
			err = RewritePathsLinks(revision.Links, baseDir, newDir)
			if err != nil {
				return err
			}
		}
	}

	// Metadata.Roles.Links.Href
	if metadata.Roles != nil {
		for i, role := range *metadata.Roles {
			err = RewritePathsLinks(role.Links, baseDir, newDir)
			if err != nil {
				return err
			}
			(*metadata.Roles)[i] = role
		}
	}

	// Metadata.Locations.Links.Href
	if metadata.Locations != nil {
		for i, location := range *metadata.Locations {
			err = RewritePathsLinks(location.Links, baseDir, newDir)
			if err != nil {
				return err
			}
			(*metadata.Locations)[i] = location
		}
	}

	// Metadata.Parties.Links.Href
	if metadata.Parties != nil {
		for i, party := range *metadata.Parties {
			err = RewritePathsLinks(party.Links, baseDir, newDir)
			if err != nil {
				return err
			}
			(*metadata.Parties)[i] = party
		}
	}

	// Metadata.ResponsibleParties.Links.Href
	if metadata.ResponsibleParties != nil {
		err = RewritePathsResponsibleParties(metadata.ResponsibleParties, baseDir, newDir)
		if err != nil {
			return err
		}
	}

	// Metadata.Actions.Links.Href
	if metadata.Actions != nil {
		for i, action := range *metadata.Actions {
			err = RewritePathsLinks(action.Links, baseDir, newDir)
			if err != nil {
				return err
			}
			(*metadata.Actions)[i] = action
		}
	}

	return nil
}

// RewritePathsLinks rewrites the paths found in oscalTypes.Link (originally relative to baseDir) to be relative to newDir
func RewritePathsLinks(links *[]oscalTypes.Link, baseDir string, newDir string) (err error) {
	if links == nil {
		return nil
	}

	for i, link := range *links {
		link.Href, err = common.RemapPath(link.Href, baseDir, newDir)
		if err != nil {
			return fmt.Errorf("error remapping path %s: %v", link.Href, err)
		}
		(*links)[i] = link
	}
	return nil
}

// RewritePathsResponsibleParties rewrites the paths found in oscalTypes.ResponsibleParty (originally relative to baseDir) to be relative to newDir
func RewritePathsResponsibleParties(responsibleParties *[]oscalTypes.ResponsibleParty, baseDir string, newDir string) (err error) {
	if responsibleParties == nil {
		return nil
	}

	for i, responsibleParty := range *responsibleParties {
		err = RewritePathsLinks(responsibleParty.Links, baseDir, newDir)
		if err != nil {
			return err
		}
		(*responsibleParties)[i] = responsibleParty
	}
	return nil
}

// RewritePathsResponsibleRoles rewrites the paths found in oscalTypes.ResponsibleRole (originally relative to baseDir) to be relative to newDir
func RewritePathsResponsibleRoles(responsibleRoles *[]oscalTypes.ResponsibleRole, baseDir string, newDir string) (err error) {
	if responsibleRoles == nil {
		return nil
	}

	for i, responsibleRole := range *responsibleRoles {
		err = RewritePathsLinks(responsibleRole.Links, baseDir, newDir)
		if err != nil {
			return err
		}
		(*responsibleRoles)[i] = responsibleRole
	}
	return nil
}

// RewritePathsControlImplementationSet rewrites the paths found in oscalTypes.ControlImplementationSet (originally relative to baseDir) to be relative to newDir
func RewritePathsControlImplementationSet(controlImplementationSet *[]oscalTypes.ControlImplementationSet, baseDir string, newDir string) (err error) {
	if controlImplementationSet == nil {
		return nil
	}

	for idx, impl := range *controlImplementationSet {
		err = RewritePathsLinks(impl.Links, baseDir, newDir)
		if err != nil {
			return err
		}

		if impl.Source != "" {
			source, err := common.RemapPath(impl.Source, baseDir, newDir)
			if err != nil {
				return fmt.Errorf("error remapping path %s: %v", impl.Source, err)
			}
			(*controlImplementationSet)[idx].Source = source
		}

		err = RewritePathsImplementedRequirementControlImplementation(&impl.ImplementedRequirements, baseDir, newDir)
		if err != nil {
			return err
		}
	}

	return nil
}

// RewritePathsImplementedRequirementControlImplementation rewrites the paths found in oscalTypes.ImplementedRequirementControlImplementation (originally relative to baseDir) to be relative to newDir
func RewritePathsImplementedRequirementControlImplementation(implementedRequirementControlImplementation *[]oscalTypes.ImplementedRequirementControlImplementation, baseDir string, newDir string) (err error) {
	if implementedRequirementControlImplementation == nil {
		return nil
	}

	for _, req := range *implementedRequirementControlImplementation {
		err = RewritePathsLinks(req.Links, baseDir, newDir)
		if err != nil {
			return err
		}

		err = RewritePathsResponsibleRoles(req.ResponsibleRoles, baseDir, newDir)
		if err != nil {
			return err
		}

		err = RewritePathsControlStatementImplementation(req.Statements, baseDir, newDir)
		if err != nil {
			return err
		}
	}

	return nil
}

// RewritePathsControlStatementImplementation rewrites the paths found in oscalTypes.ControlStatementImplementation (originally relative to baseDir) to be relative to newDir
func RewritePathsControlStatementImplementation(statements *[]oscalTypes.ControlStatementImplementation, baseDir string, newDir string) (err error) {
	if statements == nil {
		return nil
	}

	for _, statement := range *statements {
		err = RewritePathsLinks(statement.Links, baseDir, newDir)
		if err != nil {
			return err
		}

		err = RewritePathsResponsibleRoles(statement.ResponsibleRoles, baseDir, newDir)
		if err != nil {
			return err
		}
	}
	return nil
}
