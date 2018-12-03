import versioneer

from setuptools import setup, find_packages

setup(
    name='jupyterlab-quickopen',
    version=versioneer.get_version(),
    cmdclass=versioneer.get_cmdclass(),
    description='Quickly open a file in JupyterLab by typing part of its name',
    author='Peter Parente',
    install_requires=[
        'notebook>=5.2'
    ],
    data_files=[
        ("etc/jupyter/jupyter_notebook_config.d", [
            "config/jupyterlab_quickopen.json"
        ])
    ],
    packages=find_packages(),
    include_package_data=True,
    license='MIT'
)
