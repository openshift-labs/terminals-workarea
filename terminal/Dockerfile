FROM centos/s2i-base-centos7:latest

USER root

# Install additional common utilities.

RUN HOME=/root && \
    INSTALL_PKGS="nano python-devel" && \
    yum install -y centos-release-scl && \
    yum -y --setopt=tsflags=nodocs install --enablerepo=centosplus $INSTALL_PKGS && \
    rpm -V $INSTALL_PKGS && \
    yum -y clean all --enablerepo='*'

# Install Python.

RUN HOME=/root && \
    INSTALL_PKGS="rh-python36 rh-python36-python-devel \
        rh-python36-python-setuptools rh-python36-python-pip \
        httpd24 httpd24-httpd-devel httpd24-mod_ssl httpd24-mod_auth_kerb \
        httpd24-mod_ldap httpd24-mod_session atlas-devel gcc-gfortran \
        libffi-devel libtool-ltdl" && \
    yum install -y centos-release-scl && \
    yum -y --setopt=tsflags=nodocs install --enablerepo=centosplus $INSTALL_PKGS && \
    rpm -V $INSTALL_PKGS && \
    # Remove centos-logos (httpd dependency) to keep image size smaller.
    rpm -e --nodeps centos-logos && \
    yum -y clean all --enablerepo='*'

# Install Java JDK, Maven and Gradle.

RUN HOME=/root && \
    INSTALL_PKGS="bc java-1.8.0-openjdk java-1.8.0-openjdk-devel" && \
    yum install -y --enablerepo=centosplus $INSTALL_PKGS && \
    rpm -V $INSTALL_PKGS && \
    yum -y clean all --enablerepo='*'

RUN HOME=/root && \
    (curl -s -0 http://www.eu.apache.org/dist/maven/maven-3/3.3.9/binaries/apache-maven-3.3.9-bin.tar.gz | \
    tar -zx -C /usr/local) && \
    mv /usr/local/apache-maven-3.3.9 /usr/local/maven && \
    ln -sf /usr/local/maven/bin/mvn /usr/local/bin/mvn

RUN HOME=/root && \
    curl -sL -0 https://services.gradle.org/distributions/gradle-2.6-bin.zip -o /tmp/gradle-2.6-bin.zip && \
    unzip /tmp/gradle-2.6-bin.zip -d /usr/local/ && \
    rm /tmp/gradle-2.6-bin.zip && \
    mv /usr/local/gradle-2.6 /usr/local/gradle && \
    ln -sf /usr/local/gradle/bin/gradle /usr/local/bin/gradle

# Install OpenShift clients.

RUN curl -s -o /tmp/oc.tar.gz https://mirror.openshift.com/pub/openshift-v3/clients/3.10.79/linux/oc.tar.gz && \
    tar -C /usr/local/bin -zxvf /tmp/oc.tar.gz oc && \
    mv /usr/local/bin/oc /usr/local/bin/oc-3.10.79 && \
    rm /tmp/oc.tar.gz && \
    curl -s -o /tmp/oc.tar.gz https://mirror.openshift.com/pub/openshift-v3/clients/3.11.44/linux/oc.tar.gz && \
    tar -C /usr/local/bin -zxvf /tmp/oc.tar.gz oc && \
    mv /usr/local/bin/oc /usr/local/bin/oc-3.11.44 && \
    rm /tmp/oc.tar.gz

RUN curl -sL -o /usr/local/bin/odo-0.0.14 https://github.com/redhat-developer/odo/releases/download/v0.0.14/odo-linux-amd64 && \
    chmod +x /usr/local/bin/odo-0.0.14

# Install Kubernetes client.

RUN curl -sL -o /usr/local/bin/kubectl https://storage.googleapis.com/kubernetes-release/release/v1.10.0/bin/linux/amd64/kubectl && \
    mv /usr/local/bin/kubectl /usr/local/bin/kubectl-1.10.0 && \
    chmod +x /usr/local/bin/kubectl-1.10.0 && \
    curl -sL -o /usr/local/bin/kubectl https://storage.googleapis.com/kubernetes-release/release/v1.11.0/bin/linux/amd64/kubectl && \
    mv /usr/local/bin/kubectl /usr/local/bin/kubectl-1.11.0 && \
    chmod +x /usr/local/bin/kubectl-1.11.0

# Common environment variables.

ENV PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=UTF-8 \
    LC_ALL=en_US.UTF-8 \
    LANG=en_US.UTF-8 \
    PIP_NO_CACHE_DIR=off

# Install Supervisor and Butterfly using system Python 2.7.

RUN HOME=/opt/workshop && \
    mkdir -p /opt/workshop && \
    curl -s -o /tmp/get-pip.py https://bootstrap.pypa.io/get-pip.py && \
    /usr/bin/python /tmp/get-pip.py --user && \
    rm -f /tmp/get-pip.py && \
    $HOME/.local/bin/pip install --no-cache-dir --user virtualenv && \
    $HOME/.local/bin/virtualenv /opt/workshop && \
    source /opt/workshop/bin/activate && \
    pip install supervisor==3.3.4 && \
    mkdir -p /opt/app-root/etc && \
    pip install butterfly==3.2.5 && \
    rm /opt/app-root/etc/scl_enable

# Install Node.js packages.

RUN HOME=/opt/workshop && \
    cd /opt/workshop && \
    source scl_source enable rh-nodejs8 && \
    mkdir /opt/app-root/node_modules && \
    ln -s /opt/app-root/node_modules /opt/workshop/node_modules && \
    npm install express http-proxy-middleware express-basic-auth \
        simple-oauth2 uuid express-session pug && \
    chown -R 1001:0 /opt/app-root/node_modules && \
    fix-permissions /opt/app-root/node_modules

COPY gateway.js /opt/workshop/

# Finish environment setup.

ENV BASH_ENV=/opt/workshop/etc/profile \
    ENV=/opt/workshop/etc/profile \
    PROMPT_COMMAND=". /opt/workshop/etc/profile"

COPY s2i/. /usr/libexec/s2i/

COPY bin/. /opt/workshop/bin/
COPY etc/. /opt/workshop/etc/
COPY routes/. /opt/workshop/routes/

RUN echo "auth required pam_wheel.so use_uid" >> /etc/pam.d/su && \
    chmod g+w /etc/passwd

RUN mkdir -p /opt/app-root/etc/init.d && \
    mkdir -p /opt/app-root/etc/profile.d && \
    mkdir -p /opt/app-root/routes && \
    chown -R 1001:0 /opt/app-root && \
    fix-permissions /opt/app-root

RUN source scl_source enable rh-python36 && \
    virtualenv /opt/app-root && \
    source /opt/app-root/bin/activate && \
    pip install -U pip setuptools wheel && \
    ln -s /opt/workshop/bin/oc /opt/app-root/bin/oc && \
    ln -s /opt/workshop/bin/odo /opt/app-root/bin/odo && \
    ln -s /opt/workshop/bin/kubectl /opt/app-root/bin/kubectl && \
    chown -R 1001:0 /opt/app-root && \
    fix-permissions /opt/app-root -P

COPY profiles/. /opt/workshop/etc/profile.d/

LABEL io.k8s.display-name="Terminal" \
      io.openshift.expose-services="8080:http" \
      io.openshift.tags="builder,butterfly" \
      io.openshift.s2i.scripts-url=image:///usr/libexec/s2i

EXPOSE 8080

USER 1001

CMD [ "/usr/libexec/s2i/run" ]
