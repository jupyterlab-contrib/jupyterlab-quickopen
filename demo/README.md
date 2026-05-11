# Demo

This directory contains configuration files for running a JupyterLite demo with the quickopen extension.

## Files

- `requirements.txt` - JupyterLite dependencies
- `overrides.json` - JupyterLab settings for frontend indexing, `.gitignore` support, and showing
  hidden files in the file browser
- `jupyter_lite_config.json` - JupyterLite build configuration that includes hidden files in the
  generated Contents API

## Usage

Build and serve a JupyterLite instance with the quickopen extension configured for frontend-based file indexing.
The demo is also configured to honor `.gitignore` files and show hidden files in the file browser.
