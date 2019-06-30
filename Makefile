SHELL:=bash
PKG_SLUG:=jupyterlab-quickopen
PKG_NAME:=jupyterlab_quickopen

help:
# http://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

clean: ## Make a clean source tree
	-find . -name '*.pyc' -exec rm -fv {} \;
	rm -rf $(PKG_NAME)/__pycache__ __pycache__
	rm -rf *.egg-info
	rm -rf node_modules
	rm -rf lib

pipenv: ## Make a pipenv development environment
	pipenv --python 3.7
	PIPENV_VENV_IN_PROJECT=true pipenv sync --dev

shell: ## Make a pipenv shell
	pipenv shell

build: ## Make an install of the frontend and server extensions
	jlpm install
	jupyter labextension install . --no-build
	pip install -e .
	jupyter serverextension enable $(PKG_NAME)

release: ## Make a release on PyPI and npmjs.org
	python setup.py sdist
	twine upload dist/*.tar.gz
	npm publish --access=public

watch-lab: ## Make a JupyterLab build process watch for extension builds
	jupyter lab --watch

watch-src: ## Make a TypeScript build process watch for source changes
	jlpm run watch