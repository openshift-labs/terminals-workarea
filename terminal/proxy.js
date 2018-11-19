var express = require('express');
var proxy = require('http-proxy-middleware');
var basic_auth = require('express-basic-auth')
var session = require('express-session');
var uuid = require('uuid');
var http = require('http');
var url = require('url');

var app = express();

var uri_root_path = process.env.URI_ROOT_PATH || '';

var terminal_app = 'http://127.0.0.1:8081';

// For standalone container deployment, provide ability to add
// authentication using HTTP Basic authentication.

var auth_username = process.env.AUTH_USERNAME;
var auth_password = process.env.AUTH_PASSWORD;

if (auth_username) {
    app.use(basic_auth({
        challenge: true,
        realm: 'Terminal',
        authorizer: function (username, password) {
            return username == auth_username && password == auth_password;
        }
    }));
}

// For JupyterHub, to ensure that only the user, or an admin can access
// anything, we need to perform an oauth handshake with JupyterHub and
// then validate that the user making the request is allowed to access
// the specific instance.

var jupyterhub_user = process.env.JUPYTERHUB_USER;
var jupyterhub_client_id = process.env.JUPYTERHUB_CLIENT_ID;
var jupyterhub_api_url = process.env.JUPYTERHUB_API_URL;
var jupyterhub_api_token = process.env.JUPYTERHUB_API_TOKEN;
var jupyterhub_route = process.env.JUPYTERHUB_ROUTE

var hostname = process.env.HOSTNAME;

if (jupyterhub_client_id) {
    // Enable use of a client session for the user. This is used to
    // track whether the user has logged in using oauth. The expiry for
    // the cookie is relatively short as the oauth handshake is hidden
    // from the user as it is only negoitating with JupyterHub itself.
    // Having a short timeout means that the user will be periodically
    // checked as still being allowed to access the instance. This is so
    // that a change by a JupyterHub admin to status of a user is
    // detected early and they are kicked out.

    app.use(session({
        name: 'workshop-session-id',
        genid: function(req) {
            return uuid.v4()
        },
        secret: jupyterhub_api_token,
        cookie: {
            path: uri_root_path,
            maxAge: 60*1000
        },
        resave: false,
        saveUninitialized: true
    }));

    // Setup details for the oauth handshake with JupyterHub.

    var api_url = url.parse(jupyterhub_api_url);

    var credentials = {
      client: {
        id: jupyterhub_client_id,
        secret: jupyterhub_api_token
      },
      auth: {
        tokenHost: jupyterhub_route,
        authorizePath: api_url.pathname + '/oauth2/authorize',
        tokenPath: api_url.pathname + '/oauth2/token'
      },
      options: {
          authorizationMethod: 'body',
      },
      http: {
          rejectUnauthorized: false
      }
    };

    var oauth2 = require('simple-oauth2').create(credentials);

    // Define the oauth callback URL. This is the means that the access
    // token is passed back from JupyterHub for the user. From within
    // this we also check back with JupyterHub that the user has access
    // to this instance by fetching the user details and ensuring they
    // are an admin or they are the user for the instance.

    app.get(uri_root_path + '/oauth_callback', async (req, res) => {
        try {
            var code = req.query.code;
            var state = req.query.state;

            // This is retrieve the next URL to redirect to from the session
            // for this particular oauth handshake.

            var next_url = req.session.handshakes[state];
            delete req.session.handshakes[state];

            var options = {
                code: code,
                redirect_uri: uri_root_path + '/oauth_callback',
            };

            var auth_result = await oauth2.authorizationCode.getToken(options);
            var token_result = oauth2.accessToken.create(auth_result);

            var user_url = jupyterhub_api_url + '/user';

	    var parsed_user_url = url.parse(user_url);

	    var user_url_options = {
		host: parsed_user_url.hostname,
		port: parsed_user_url.port,
		path: parsed_user_url.path,
		headers: {
		    authorization: 'token ' + token_result.token.access_token
		}
	    };

            // This is the callback to fetch the user details from
            // JupyterHub so we can authorize that they have access.

	    http.get(user_url_options, (user_res) => {
		let data = '';

		user_res.on('data', (chunk) => {
		    data += chunk;
		});

                user_res.on('end', () => {
		    user = JSON.parse(data);

                    // The user who has logged in must be an admin or
                    // the user of the instance.

		    if (!user.admin) {
                        if (user.name != jupyterhub_user) {
                            return res.status(403).json('Access forbidden');
                        }
                    }

                    req.session.user = user;

                    console.log('Allowing access to', user);

		    res.redirect(next_url);

                    return;
                });
	    }).on('error', (err) => {
	        console.error('Error', err.message);
                return res.status(500).json('Error occurred');
	    });

            return;
        } catch(err) {
            console.error('Error', err.message);
            return res.status(500).json('Authentication failed');
        }
    });

    // Handler which triggers the oauth handshake. Will be redirected
    // here whenever any request arrives and user has not been verified
    // or when the user session has expired and need to revalidate.

    app.get(uri_root_path + '/auth', (req, res) => {
        // Stash the next URL after authentication in the user session
        // keyed by unique code for this oauth handshake. Use the code
        // as the state for oauth requests.

        if (Object.keys(req.session.handshakes).length > 10) {
            // If the number of oustanding auth handshakes gets to be
            // too many, something fishy going on so clear them all and
            // start over again.

            req.session.handshakes = {}
        }

        state = uuid.v4();
        req.session.handshakes[state] = req.query.next;

        const authorization_uri = oauth2.authorizationCode.authorizeURL({
            redirect_uri: uri_root_path + '/oauth_callback',
            state: state
        });

        res.redirect(authorization_uri);
    });

    // This intercepts all incoming requests and if the user hasn't been
    // validated, or validation has expired, then will redirect into the
    // oauth handshake.

    app.use(function (req, res, next) {
        if (!req.session.handshakes)
            req.session.handshakes = {};

        if (!req.session.user) {
            next_url = encodeURIComponent(req.url);
	    res.redirect(uri_root_path + '/auth?next=' + next_url);
        }
        else
            next();
    })
}

// Redirecting to terminal at a sub path. This is to allow other
// applications to be hosted behind this proxy if necessary.

app.get('^' + uri_root_path + '/?$', function (req, res) {
    res.redirect(uri_root_path + '/terminal');
})

// If no terminal session provided, redirect to session 1. This ensures
// user always get the same session and not a new one each time if refresh
// the web browser or access same URL from another browser window.

app.get('^' + uri_root_path + '/terminal/?$', function (req, res) {
    res.redirect(uri_root_path + '/terminal/session/1');
})

// Setup proxy for the terminal application.

app.use('^' + uri_root_path + '/terminal/', proxy({
    target: terminal_app,
    ws: true
}));

app.listen(8080);
