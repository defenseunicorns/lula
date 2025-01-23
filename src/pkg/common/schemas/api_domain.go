package schemas

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
