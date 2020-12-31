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

RUN apt update \
    && apt install -q wamerican \
    && pip install --no-cache jupyterlab-quickopen \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
RUN cd $(dirname $(which jupyter-notebook)) \
    && rm jupyter-notebook \
    && ln -s jupyter-server jupyter-notebook
