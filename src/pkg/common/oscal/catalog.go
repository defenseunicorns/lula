package oscal

import (
	"github.com/defenseunicorns/go-oscal/src/pkg/validation"
	oscalTypes_1_1_2 "github.com/defenseunicorns/go-oscal/src/types/oscal-1-1-2"
	"github.com/defenseunicorns/lula/src/pkg/message"
	"gopkg.in/yaml.v3"
)

// NewCatalog creates a new catalog object from the given data.
func NewCatalog(data []byte) (catalog *oscalTypes_1_1_2.Catalog, err error) {
	var oscalModels oscalTypes_1_1_2.OscalModels

	// create a new validator
	validator, err := validation.NewValidator(data)
	if err != nil {
		return catalog, err
	}
	// validate the catalog
	err = validator.Validate()
	if err != nil {
		return catalog, err
	}

	// unmarshal the catalog
	// yaml.v3 unmarshal handles both json and yaml
	err = yaml.Unmarshal(data, &oscalModels)
	if err != nil {
		message.Debugf("Error marshalling yaml: %s\n", err.Error())
		return catalog, err

	}

	return oscalModels.Catalog, nil
}
