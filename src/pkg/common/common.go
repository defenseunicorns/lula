package common

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/defenseunicorns/go-oscal/src/pkg/utils"
	oscalTypes_1_1_2 "github.com/defenseunicorns/go-oscal/src/types/oscal-1-1-2"
	"github.com/defenseunicorns/lula/src/pkg/common/oscal"
	"github.com/defenseunicorns/lula/src/pkg/domains/api"
	kube "github.com/defenseunicorns/lula/src/pkg/domains/kubernetes"
	"github.com/defenseunicorns/lula/src/pkg/message"
	"github.com/defenseunicorns/lula/src/pkg/providers/kyverno"
	"github.com/defenseunicorns/lula/src/pkg/providers/opa"
	"github.com/defenseunicorns/lula/src/types"
	goversion "github.com/hashicorp/go-version"
	"gopkg.in/yaml.v3"
)

const (
	UUID_PREFIX    = "#"
	WILDCARD       = "*"
	YAML_DELIMITER = "---"
)

// TrimIdPrefix trims the id prefix from the given id
func TrimIdPrefix(id string) string {
	return strings.TrimPrefix(id, UUID_PREFIX)
}

// AddIdPrefix adds the id prefix to the given id
func AddIdPrefix(id string) string {
	return fmt.Sprintf("%s%s", UUID_PREFIX, id)
}

// IsLulaLink checks if the link is a lula link
func IsLulaLink(link oscalTypes_1_1_2.Link) bool {
	rel := strings.Split(link.Rel, ".")
	return link.Text == "Lula Validation" || rel[0] == "lula"
}

// ReadFileToBytes reads a file to bytes
func ReadFileToBytes(path string) ([]byte, error) {
	var data []byte
	_, err := os.Stat(path)
	if os.IsNotExist(err) {
		return data, fmt.Errorf("Path: %v does not exist - unable to digest document", path)
	}
	data, err = os.ReadFile(path)
	if err != nil {
		return data, err
	}

	return data, nil
}

// WriteOscalModel takes a path and writes content to a file while performing checks for existing content
// supports both json and yaml
func WriteOscalModel(filePath string, model *oscalTypes_1_1_2.OscalModels) error {

	// if no path or directory add default filename
	if filepath.Ext(filePath) == "" {
		filePath = filepath.Join(filePath, "oscal.yaml")
	}

	if err := utils.IsJsonOrYaml(filePath); err != nil {
		return err
	}

	if _, err := os.Stat(filePath); err == nil {
		// If the file exists - read the data into the model
		existingFileBytes, err := os.ReadFile(filePath)
		if err != nil {
			return err
		}
		existingModel, err := oscal.NewOscalModel(existingFileBytes)
		if err != nil {
			return err
		}
		// Merge the existing model with the new model
		// re-assign to perform common operations below
		model, err = oscal.MergeOscalModels(existingModel, model)
		if err != nil {
			return err
		}
	}

	var b bytes.Buffer

	if filepath.Ext(filePath) == ".json" {
		jsonEncoder := json.NewEncoder(&b)
		jsonEncoder.SetIndent("", "  ")
		jsonEncoder.Encode(model)
	} else {
		yamlEncoder := yaml.NewEncoder(&b)
		yamlEncoder.SetIndent(2)
		yamlEncoder.Encode(model)
	}

	err := utils.WriteOutput(b.Bytes(), filePath)
	if err != nil {
		return err
	}

	message.Infof("OSCAL artifact written to: %s", filePath)

	return nil

}

// Returns version validity
func IsVersionValid(versionConstraint string, version string) (bool, error) {
	if version == "unset" {
		// Default cli version is "unset", enabling users to run directly from source code
		// This is not a valid version, but we want to allow it for development purposes
		return true, nil
	}

	currentVersion, err := goversion.NewVersion(version)
	if err != nil {
		return false, err
	}
	constraints, err := goversion.NewConstraint(versionConstraint)
	if err != nil {
		return false, err
	}
	if constraints.Check(currentVersion) {
		return true, nil
	}
	return false, nil
}

// SetCwdToFileDir takes a path and changes the current working directory to the directory of the path
func SetCwdToFileDir(dirPath string) (resetFunc func(), err error) {
	// Bail if empty
	if dirPath == "" {
		return resetFunc, fmt.Errorf("dirPath is empty")
	}
	info, err := os.Stat(dirPath)
	// Bail if the path does not exist
	if err != nil {
		return resetFunc, err
	}
	// Get the directory of the path if it is not a directory
	if !info.IsDir() {
		dirPath = filepath.Dir(dirPath)
	}

	// Save the current working directory
	originalDir, err := os.Getwd()
	if err != nil {
		return resetFunc, err
	}

	// Change the current working directory
	err = os.Chdir(dirPath)
	if err != nil {
		return resetFunc, err
	}

	// Return a function to change the current working directory back to the original directory
	resetFunc = func() {
		err = os.Chdir(originalDir)
		if err != nil {
			message.Warnf("unable to change cwd back to %s: %v", originalDir, err)
		}
	}

	// Change back to the original working directory when done
	return resetFunc, err
}

// Get the domain and providers
func GetDomain(domain *Domain, ctx context.Context) types.Domain {
	if domain == nil {
		return nil
	}
	switch domain.Type {
	case "kubernetes":
		return kube.KubernetesDomain{
			Context: ctx,
			Spec:    *domain.KubernetesSpec,
		}
	case "api":
		return api.ApiDomain{
			Spec: *domain.ApiSpec,
		}
	default:
		return nil
	}
}

func GetProvider(provider *Provider, ctx context.Context) types.Provider {
	if provider == nil {
		return nil
	}
	switch provider.Type {
	case "opa":
		return opa.OpaProvider{
			Context: ctx,
			Spec:    *provider.OpaSpec,
		}
	case "kyverno":
		return kyverno.KyvernoProvider{
			Context: ctx,
			Spec:    *provider.KyvernoSpec,
		}
	default:
		return nil
	}
}

// Converts a raw string to a Validation object (string -> common.Validation -> types.Validation)
func ValidationFromString(raw string) (validation types.LulaValidation, err error) {
	if raw == "" {
		return validation, fmt.Errorf("validation string is empty")
	}

	var validationData Validation
	err = validationData.UnmarshalYaml([]byte(raw))
	if err != nil {
		return validation, err
	}

	validation, err = validationData.ToLulaValidation()
	if err != nil {
		return validation, err
	}

	return validation, nil
}
