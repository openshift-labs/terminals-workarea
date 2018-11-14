#!/bin/bash

set -eo pipefail

set -x

if [ x"$JUPYTERHUB_SERVICE_PREFIX" != x"" ]; then
    URI_ROOT_PATH=${JUPYTERHUB_SERVICE_PREFIX%/}
    export URI_ROOT_PATH
fi


cd /opt/workshop

exec node /opt/workshop/proxy.js
