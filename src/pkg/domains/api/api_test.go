package api

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestExecuteTpl(t *testing.T) {
	tests := map[string]struct {
		tplStr    string
		vars      map[string]map[string]interface{}
		want      string
		expectErr bool
	}{
		"basic success": {
			tplStr: `hello, [[.login.username]]!`,
			vars: map[string]map[string]interface{}{
				"login": {
					"username": "cheetarah",
				},
			},
			want:      "hello, cheetarah!",
			expectErr: false,
		},
		"success": {
			tplStr: `hello, [[ (index .login.usernames 0) ]]!`,
			vars: map[string]map[string]interface{}{
				"login": {
					"usernames": []string{"batcat", "cheetarah"},
				},
			},
			want:      "hello, batcat!",
			expectErr: false,
		},
		//TODO: we should catch this, possibly at an earlier stage (validation schema)
		"invalid tplStr, not an error": {
			tplStr: `hello, {{.login.username]]!`,
			vars: map[string]map[string]interface{}{
				"login": {
					"username": "cheetarah",
				},
			},
			want:      "",
			expectErr: false,
		},
	}

	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			got, err := executeTpl(test.tplStr, test.vars)
			if (err != nil) != test.expectErr {
				t.Fatalf("error = %v, expectErr %v", err, test.expectErr)
			}
			if err != nil {
				require.Equal(t, test.want, got)
			}
		})
	}

}
