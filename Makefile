SHELL:=bash
PKG_SLUG:=jupyterlab-quickopen
PKG_NAME:=jupyterlab_quickopen

help:
# http://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

clean: ## Make a clean source tree
	-find . -name '*.pyc' -exec rm -fv {} \;
	rm -rf $(PKG_NAME)/__pycache__ __pycache__
	rm -rf *.egg-info node_modules/ lib/ dist/

venv: ## Make a development virtual env
	python3 -m venv .venv
	source ./.venv/bin/activate \
		&& pip install -r requirements-dev.txt\
		&& pip install -e . \
		&& jupyter labextension develop . --overwrite

shell: ## Make a shell in the venv
	@echo "source ./.venv/bin/activate"

build: ## Make an install of the frontend and server extensions
	@jlpm run build

release: ## Make a release on PyPI and npmjs.org
	# TODO: update
	rm -rf dist/
	python setup.py sdist
	ls -l dist/
	twine upload dist/*.tar.gz
	npm publish --access=public

watch: ## Watch source changes and rebuild
	jlpm run watch