# Based on https://mybinder.readthedocs.io/en/latest/examples/sample_repos.html#minimal-dockerfiles-for-binder
FROM python:3.9-slim

ARG NB_USER
ARG NB_UID
ENV USER ${NB_USER}
ENV HOME /home/${NB_USER}

RUN adduser --disabled-password \
    --gecos "Default user" \
    --uid ${NB_UID} \
    ${NB_USER}
WORKDIR ${HOME}

# Add project and demo dependencies
RUN apt update \
    && apt install -y -q wamerican procps \
    && pip install --no-cache jupyterlab-quickopen \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# As of 2020-12-31, force binder to use jupyter-server instead of jupyter-notebook
RUN cd $(dirname $(which jupyter-notebook)) \
    && rm jupyter-notebook \
    && ln -s jupyter-server jupyter-notebook

# Add the entire source tree
ADD . .
RUN chown -R $NB_UID  .