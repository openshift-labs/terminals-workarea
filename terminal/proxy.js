var express = require('express');
var proxy = require('http-proxy-middleware');
var basic_auth = require('express-basic-auth')

var app = express();

var uri_root_path = process.env.URI_ROOT_PATH || '';

var terminal_app = 'http://127.0.0.1:8081';

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

app.get('^' + uri_root_path + '/?$', function (req, res) {
    res.redirect(uri_root_path + '/session/1');
})

app.use(uri_root_path, proxy({
    target: terminal_app,
    ws: true
}));

app.listen(8080);
