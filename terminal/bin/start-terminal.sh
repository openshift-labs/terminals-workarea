#!/bin/bash

set -a
. /opt/workshop/etc/envvars
set +a

export SHELL=/bin/bash

if [ x"$JUPYTERHUB_USER" != x"" ]; then
    export PS1="[$JUPYTERHUB_USER:\w] $ "
else
    export PS1="[\w] $ "
fi

unset JUPYTERHUB_ADMIN_ACCESS
unset JUPYTERHUB_BASE_URL
unset JUPYTERHUB_CLIENT_ID
unset JUPYTERHUB_API_TOKEN
unset JUPYTERHUB_API_URL
unset JUPYTERHUB_USER
unset JUPYTER_IMAGE_SPEC
unset JUPYTERHUB_OAUTH_CALLBACK_URL
unset JUPYTER_IMAGE
unset JUPYTERHUB_HOST
unset JUPYTERHUB_SERVICE_PREFIX

exec /bin/bash "$@"
