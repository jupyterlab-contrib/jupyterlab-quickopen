SHELL:=bash
PKG_SLUG:=jupyterlab-quickopen
PKG_NAME:=jupyterlab_quickopen
CONDA_ENV:=jupyterlab-quickopen

help:
# http://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

clean: ## Make a clean source tree
	-find . -name '*.pyc' -exec rm -fv {} \;
	rm -rf $(PKG_NAME)/__pycache__ __pycache__
	rm -rf *.egg-info
	rm -rf node_modules
	rm -rf lib

activate: ## Make a conda activation command for eval
	@echo "source activate $(PKG_SLUG)"

conda-env: ## Make a conda development environment
	conda create -n $(PKG_SLUG) -c conda-forge python=3 \
		--file requirements.txt --file requirements-dev.txt
	source activate $(PKG_SLUG) && \
		jlpm install && \
		jupyter labextension install . --no-build
	source activate $(PKG_SLUG) && \
		pip install -e . && \
		jupyter serverextension enable $(PKG_NAME)

release: ## Make a release on PyPI and npmjs.org
	source activate $(PKG_SLUG) && \
		python setup.py sdist && \
		twine upload dist/*.tar.gz
	source activate $(PKG_SLUG) && npm publish --access=public

watch-lab: ## Make a JupyterLab build process watch for extension builds
	source activate $(PKG_SLUG) && jupyter lab --watch

watch-src: ## Make a TypeScript build process watch for source changes
	source activate $(PKG_SLUG) && jlpm run watch