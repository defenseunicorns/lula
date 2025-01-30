package validation

// Contains the store for the requirements
type RequirementStore struct {
	requirementMap map[string]Requirement
}

func NewRequirementStore() *RequirementStore {
	return &RequirementStore{
		requirementMap: make(map[string]Requirement),
	}
}

// AddRequirement adds a requirement to the store
func (r *RequirementStore) AddRequirement(requirement Requirement) {
	r.requirementMap[requirement.ID()] = requirement
}

// GetRequirements returns the requirements in the store
func (r *RequirementStore) GetRequirement(id string) (Requirement, bool) {
	if requirement, ok := r.requirementMap[id]; ok {
		return requirement, true
	}
	return nil, false
}

// GetRequirements returns all the requirements in the store
func (r *RequirementStore) GetRequirements() []Requirement {
	requirements := make([]Requirement, 0, len(r.requirementMap))
	for _, requirement := range r.requirementMap {
		requirements = append(requirements, requirement)
	}
	return requirements
}

// Count returns the number of requirements in the store
func (r *RequirementStore) Count() int {
	return len(r.requirementMap)
}
