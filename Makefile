.PHONY: help build clean package release shell venv watch

SHELL:=bash
# keybase.io/parente
GPG_PUBKEY:=F020F9E14991B4A841BF948E573D3A785F16E056
# Default to releasing to test.pypi.org (override: make release PYPI_URI=pypi)
PYPI_URI?=testpypi

help:
# http://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

build: ## Make an install of the frontend and server extensions
	jlpm run build

check: ## Check for proper package install (not in development mode)
	jupyter-server extension list 2>&1 | grep -ie "jupyterlab_quickopen.*OK"
	jupyter labextension list 2>&1 | grep -ie "@parente/jupyterlab-quickopen.*OK"
	python -m jupyterlab.browser_check

clean: ## Make a clean source tree
	rm -rf __pycache__ \
		.ipynb_checkpoints \
		build/ \
		dist/ \
		jupyterlab_quickopen/__pycache__ \
		jupyterlab_quickopen/labextension \
		lib/ \
		node_modules/ \
		*.egg-info \
		tsconfig.tsbuildinfo

lab: ## Make a instance of jupyterlab
	jupyter lab

eslint: ## Make a linter run over the typescript
	jlpm run eslint:check

nuke: clean ## Make a clean source tree and nuke the venv
	rm -rf .venv

packages: ## Make source and wheel packages
	rm -rf dist/
	jlpm run build:prod
	python setup.py sdist bdist_wheel
	ls -l dist/

release: packages ## Make a release on PyPI
	twine check dist/*
	twine upload --repository $(PYPI_URI) --sign --identity $(GPG_PUBKEY) dist/*

shell: ## Make venv activate command to eval in the shell
	@echo "source ./.venv/bin/activate"

venv: ## Make a development virtual env
	python3 -m venv .venv
	source ./.venv/bin/activate \
		&& pip install -r requirements-dev.txt \
		&& pip install -e . \
		&& jupyter labextension develop . --overwrite \
		&& jupyter server extension enable jupyterlab_quickopen

watch: ## Watch source changes and rebuild
	jlpm run watch