package api

import (
	"context"
	"net/url"
	"time"

	"github.com/defenseunicorns/lula/src/pkg/common/schemas"
	"github.com/defenseunicorns/lula/src/types"
)

// ApiDomain is a domain that is defined by a list of API requests.
type ApiDomain struct {
	// opts are default Options will apply to all requests that don't include request-level Options
	defaults *opts
	// the parsed and validated requests
	requests []request

	// executable will be set to true during spec validation if *any* of the
	// requests are flagged executable
	executable bool
}

// opts contains the parsed API Options
type opts struct {
	headers  map[string]string
	timeout  *time.Duration
	proxyURL *url.URL
}

// request is a validated and parsed representation of the Request
type request struct {
	name          string
	reqURL        *url.URL
	reqParameters url.Values
	method        string
	body          string
	opts          *opts
}

func CreateApiDomain(spec *schemas.ApiSpec) (types.Domain, error) {
	return validateAndMutateSpec(spec)
}

func (a ApiDomain) GetResources(ctx context.Context) (types.DomainResources, error) {
	return a.makeRequests(ctx)
}

// IsExecutable returns true if any of the requests are marked executable
func (a ApiDomain) IsExecutable() bool {
	return a.executable
}
