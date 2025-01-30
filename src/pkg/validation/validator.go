package validation

import (
	"context"
)

// Contains the business logic around collecting and returning Lula Validations

type Validator struct {
	// Extracts validations from any source and populates the store
	producer ValidationProducer

	// Processes the final results after validation execution.
	consumer ResultConsumer

	// Contains the validations and requirements
	validationStore  *ValidationStore
	requirementStore *RequirementStore

	// Variables to store validator configuration behaviors
	outputDir                    string
	requestExecutionConfirmation bool
	runExecutableValidations     bool
	saveResources                bool
	strict                       bool
}

// Create a new validator
func New(producer ValidationProducer, consumer ResultConsumer, opts ...Option) (*Validator, error) {
	var validator Validator

	for _, opt := range opts {
		if err := opt(&validator); err != nil {
			return nil, err
		}
	}

	validator.validationStore = NewValidationStore()
	validator.requirementStore = NewRequirementStore()
	validator.producer = producer
	validator.consumer = consumer

	err := validator.producer.Populate(validator.validationStore, validator.requirementStore)
	if err != nil {
		return nil, err
	}

	return &validator, nil
}

// ExecuteValidations collects the validations, executes, and provides the results in the specified consumer
func (v *Validator) ExecuteValidations(ctx context.Context, runExecutableValidations bool) error {
	// Run the validations
	err := v.validationStore.RunValidations(ctx, runExecutableValidations, v.strict)
	if err != nil {
		return err
	}

	// Consumer evaluates the results -> this should execute their custom output routines
	err = v.consumer.GenerateResults(v.requirementStore)
	if err != nil {
		return err
	}

	return nil
}

func (v *Validator) GetStats() (int, int, int) {
	executableValidations := v.validationStore.GetExecutable()
	return v.requirementStore.Count(),
		v.validationStore.Count(),
		len(executableValidations)
}
