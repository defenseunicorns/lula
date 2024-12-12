package api

import (
	"context"
	"net/url"
	"time"

	"github.com/defenseunicorns/lula/src/types"
)

// ApiDomain is a domain that is defined by a list of API requests
type ApiDomain struct {
	// Spec is the specification of the API requests
	Spec *ApiSpec `json:"spec,omitempty" yaml:"spec,omitempty"`
}

func CreateApiDomain(spec *ApiSpec) (types.Domain, error) {
	// Check validity of spec
	err := validateAndMutateSpec(spec)
	if err != nil {
		return nil, err
	}

	return ApiDomain{
		Spec: spec,
	}, nil
}

func (a ApiDomain) GetResources(ctx context.Context) (types.DomainResources, error) {
	return a.makeRequests(ctx)
}

// IsExecutable returns true if any of the requests are marked executable
func (a ApiDomain) IsExecutable() bool {
	return a.Spec.executable
}

// ApiSpec contains a list of API requests
type ApiSpec struct {
	Requests []Request `mapstructure:"requests" json:"requests" yaml:"requests"`
	// Opts will be applied to all requests, except those which have their own
	// specified ApiOpts
	Options *ApiOpts `mapstructure:"options" json:"options,omitempty" yaml:"options,omitempty"`

	// internally-managed fields
	//
	// outputs is a map of stored outputs from API calls that can be used as
	// template variables for URLTpls
	outputs map[string]map[string]interface{}
	// executable will be set to true during spec
	// validation if *any* of the requests areå flagged executable
	executable bool
}

// Request is a single API request
type Request struct {
	Name       string            `json:"name" yaml:"name"`
	URL        string            `json:"url" yaml:"url"`
	Params     map[string]string `json:"parameters,omitempty" yaml:"parameters,omitempty"`
	Method     string            `json:"method,omitempty" yaml:"method,omitempty"`
	Body       string            `json:"body,omitempty" yaml:"body,omitempty"`
	Executable bool              `json:"executable,omitempty" yaml:"executable,omitempty"`
	Outputs    []*Outputs        `json:"output,omitempty" yaml:"output,omitempty"`
	// ApiOpts specific to this request. If ApiOpts is present, values in the
	// ApiSpec-level Options are ignored for this request.
	Options *ApiOpts `json:"options,omitempty" yaml:"options,omitempty"`

	// POC: user-input template strings to process like go templates
	URLTpl    string            `json:"url_tpl" yaml:"url_tpl"`
	ParamsTpl map[string]string `json:"params_tpl" yaml:"url_tpl"`

	// internally-managed options
	reqURL        *url.URL
	reqParameters url.Values
}

func (r Request) DeepCopy() Request {
	copy := Request{
		Name:       r.Name,
		URL:        r.URL,
		Method:     r.Method,
		Executable: r.Executable,
		Options:    r.Options.DeepCopy(),
		URLTpl:     r.URLTpl,
	}

	// params, params template
	params := make(map[string]string, len(r.Params))
	for k, v := range r.Params {
		params[k] = v
	}
	copy.Params = params

	paramTpls := make(map[string]string, len(r.ParamsTpl))
	for k, v := range r.ParamsTpl {
		paramTpls[k] = v
	}
	copy.Params = paramTpls

	// outputs
	outputs := make([]*Outputs, len(r.Outputs))
	for i := range r.Outputs {
		outputs[i] = r.Outputs[i]
	}
	copy.Outputs = outputs
	return copy
}

type ApiOpts struct {
	// Timeout in seconds
	Timeout string            `json:"timeout,omitempty" yaml:"timeout,omitempty"`
	Proxy   string            `json:"proxy,omitempty" yaml:"proxy,omitempty"`
	Headers map[string]string `json:"headers,omitempty" yaml:"headers,omitempty"`

	// POC: user-input template strings to process like go templates
	// TODO: ensure that top-level options cannot have HeaderTpl, only request-level options
	HeadersTpl map[string]string `json:"header_tpl" yaml:"url_tpl"`

	// internally-managed options
	timeout  *time.Duration
	proxyURL *url.URL
}

type Outputs struct {
	Name string `json:"name" yaml:"name"` // the output will be addressed by RequestName.OutputName
	Path string `json:"path" yaml:"path"` // not really sure what to call this - just go all in with jq? jqpath? jsonpath?
}

func (a ApiOpts) DeepCopy() *ApiOpts {
	copy := &ApiOpts{
		Timeout:    a.Timeout,
		Proxy:      a.Proxy,
		Headers:    a.Headers,
		HeadersTpl: a.HeadersTpl,
	}

	if a.timeout != nil {
		copy.timeout = a.timeout
	}
	if a.proxyURL != nil {
		copy.proxyURL = a.proxyURL
	}

	return copy
}
