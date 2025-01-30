package validation

import (
	"github.com/defenseunicorns/lula/src/pkg/common"
	"github.com/defenseunicorns/lula/src/pkg/common/oscal"
	"github.com/defenseunicorns/lula/src/types"
)

// A Validation Producer interface defines the requirements, how to meet them, and associated validations
type ValidationProducer interface {
	// Populate populates the validation store with the validations from the producer
	// and the defined requirements
	Populate(validationStore *ValidationStore, requirementStore *RequirementStore) error
}

// ComponentDefinitionProducer is a producer of validations referenced via OSCAL component definition
type ComponentDefinitionProducer struct {
	componentDefinition *oscal.ComponentDefinition
	requirements        []*ComponentDefinitionRequirement
}

func NewComponentProducer(compdef *oscal.ComponentDefinition, path, target string) *ComponentDefinitionProducer {
	// get oscal model from data
	// run some kind of composition here/import routines
	// how to incorporate target? or... is this external to this? Like maybe cmd validate wraps this and
	// passes the target?
	// get all requirements?
	return &ComponentDefinitionProducer{
		componentDefinition: compdef,
		requirements:        make([]*ComponentDefinitionRequirement, 0),
	}
}

func (c *ComponentDefinitionProducer) Populate(validationStore *ValidationStore, requirementStore *RequirementStore) error {
	// TODO: Get all requirements and associated validations from component definition

	// These could be stored in the backmatter or in separate file given by the "links"

	// Get all requirements <> validations -> populate validationStore and requirementStore

	return nil
}

// SimpleProducer
type SimpleProducer struct {
	validations []common.Validation
}

func NewSimpleProducer(validations []common.Validation) *SimpleProducer {
	return &SimpleProducer{
		validations: validations,
	}
}

func (p *SimpleProducer) Populate(validationStore *ValidationStore, requirementStore *RequirementStore) error {
	lulaValidations := make([]*types.LulaValidation, 0, len(p.validations))
	for _, validation := range p.validations {
		id, err := validationStore.AddValidation(&validation)
		if err != nil {
			return err
		}
		lulaValidation, err := validationStore.GetLulaValidation(id)
		if err != nil {
			return err
		}
		lulaValidations = append(lulaValidations, lulaValidation)
	}
	simpleReqt := NewSimpleRequirement(lulaValidations, "simple")

	requirementStore.AddRequirement(simpleReqt)

	return nil
}
