package api

import (
	"context"
	"net/url"
	"time"

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

func CreateApiDomain(spec *ApiSpec) (types.Domain, error) {
	return validateAndMutateSpec(spec)
}

func (a ApiDomain) GetResources(ctx context.Context) (types.DomainResources, error) {
	return a.makeRequests(ctx)
}

// IsExecutable returns true if any of the requests are marked executable
func (a ApiDomain) IsExecutable() bool {
	return a.executable
}

// User input fields for the API Domain
// ApiSpec contains the user-defined list of API requests
type ApiSpec struct {
	Requests []Request `mapstructure:"requests" json:"requests" yaml:"requests"`
	// Opts will be applied to all requests, except those which have their own
	// specified ApiOpts
	Options *ApiOpts `mapstructure:"options" json:"options,omitempty" yaml:"options,omitempty"`
}

// Request is a user-defined single API request
type Request struct {
	Name       string            `json:"name" yaml:"name"`
	URL        string            `json:"url" yaml:"url"`
	Params     map[string]string `json:"parameters,omitempty" yaml:"parameters,omitempty"`
	Method     string            `json:"method,omitempty" yaml:"method,omitempty"`
	Body       string            `json:"body,omitempty" yaml:"body,omitempty"`
	Executable bool              `json:"executable,omitempty" yaml:"executable,omitempty"`
	// ApiOpts specific to this request. If ApiOpts is present, values in the
	// ApiSpec-level Options are ignored for this request.
	Options *ApiOpts `json:"options,omitempty" yaml:"options,omitempty"`
}

// User-defined options which can be set at the top level (for all requests) or
// request level (to apply to a single request, or override the top-level opts).
type ApiOpts struct {
	// Timeout in seconds
	Timeout string            `json:"timeout,omitempty" yaml:"timeout,omitempty"`
	Proxy   string            `json:"proxy,omitempty" yaml:"proxy,omitempty"`
	Headers map[string]string `json:"headers,omitempty" yaml:"headers,omitempty"`
}
